import { type LlmPort } from '../../ports/llm/llm.port.ts';
import { type LlmRequest } from '../../ports/llm/llm.request.ts';
import { type LlmUsage } from '../../ports/llm/llm.usage.ts';
import { type AgentState } from '../agent.state.ts';
import { type NodeContext } from '../node.context.ts';
import { type ModelTurn } from './model.turn.ts';
import { streamModelTurn, type TurnProgress } from './stream.model.turn.ts';

const CONTINUE_PROMPT = 'Continue exatamente de onde parou, sem repetir o que já escreveu.';

function mergeUsage(a: LlmUsage | null, b: LlmUsage | null): LlmUsage | null {
  if (a === null) return b;
  if (b === null) return a;
  const costA = a.costMicroUsd;
  const costB = b.costMicroUsd;
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedTokens: (a.cachedTokens ?? 0) + (b.cachedTokens ?? 0),
    ...(costA === undefined && costB === undefined ? {} : { costMicroUsd: (costA ?? 0) + (costB ?? 0) }),
  };
}

function canContinueWithinBudget(
  state: AgentState,
  ctx: NodeContext,
  extraCalls: number,
  accumulatedUsage: LlmUsage | null,
  startedAtMs: number,
): boolean {
  const totalSteps = state.usage.steps + 1 + extraCalls;
  if (totalSteps >= ctx.budget.maxSteps) return false;
  const elapsedMs = state.usage.ms + (ctx.clock.now().getTime() - startedAtMs);
  if (elapsedMs >= ctx.budget.maxMs) return false;
  const totalCost = (state.usage.costMicroUsd ?? 0) + (accumulatedUsage?.costMicroUsd ?? 0);
  if (totalCost > 0 && totalCost >= ctx.budget.maxCostMicroUsd) return false;
  return true;
}

export interface ContinueOnLengthResult {
  readonly turn: ModelTurn;
  readonly extraCalls: number;
  readonly stoppedByBudget: boolean;
}

/**
 * Continuador automatico para `finish === 'length'` (spec 037, US4, T037):
 * Sem teto fixo de tentativas ("respostas completas sempre"). Reenvia "continue de onde parou"
 * concatenando o texto no mesmo stream ate que `finish !== 'length'`, que a continuacao nao
 * acrescente texto novo ou que o orcamento da execucao seja atingido.
 */
export async function continueOnLength(input: {
  readonly llm: LlmPort;
  readonly baseRequest: LlmRequest;
  readonly initialTurn: ModelTurn;
  readonly state: AgentState;
  readonly ctx: NodeContext;
  readonly progress: TurnProgress;
  readonly onText: (text: string) => void;
  readonly startedAtMs: number;
}): Promise<ContinueOnLengthResult> {
  const { llm, baseRequest, state, ctx, progress, onText, startedAtMs } = input;
  let current = input.initialTurn;
  let extraCalls = 0;

  while (current.finish === 'length' && current.toolCalls.length === 0) {
    if (!canContinueWithinBudget(state, ctx, extraCalls, current.usage, startedAtMs)) {
      return { turn: current, extraCalls, stoppedByBudget: true };
    }
    const nextRequest: LlmRequest = {
      ...baseRequest,
      ...(baseRequest.tools !== undefined ? { toolChoice: 'none' as const } : {}),
      messages: [
        ...baseRequest.messages,
        { role: 'assistant', content: [{ type: 'text', text: current.text }] },
        { role: 'user', content: [{ type: 'text', text: CONTINUE_PROMPT }] },
      ],
    };
    const chunkProgress: TurnProgress = { text: '', emittedContent: false };
    const nextTurn = await streamModelTurn(llm.stream(nextRequest, ctx.signal), chunkProgress, (delta) => {
      progress.text += delta;
      progress.emittedContent = true;
      onText(delta);
    });
    extraCalls += 1;
    const mergedUsage = mergeUsage(current.usage, nextTurn.usage);
    if (nextTurn.text.trim() === '') {
      current = {
        ...current,
        usage: mergedUsage,
        finish: 'stop',
      };
      break;
    }
    current = {
      ...current,
      text: current.text + nextTurn.text,
      usage: mergedUsage,
      finish: nextTurn.finish,
    };
  }

  return { turn: current, extraCalls, stoppedByBudget: false };
}
