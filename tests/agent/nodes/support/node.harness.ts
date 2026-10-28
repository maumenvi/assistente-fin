import { type AgentState } from '../../../../src/app/agent/graph/agent.state.ts';
import { initialAgentState } from '../../../../src/app/agent/graph/initial.agent.state.ts';
import { type NodeContext } from '../../../../src/app/agent/graph/node.context.ts';
import { SafeTruncationStrategy } from '../../../../src/app/agent/context/safe.truncation.strategy.ts';
import { pickRoleLlm } from '../../../../src/app/agent/llm/pick.role.llm.ts';
import { type AgentEvent } from '../../../../src/app/agent/ports/events/agent.event.ts';
import { type LlmPort } from '../../../../src/app/agent/ports/llm/llm.port.ts';
import { type ToolPort } from '../../../../src/app/agent/ports/tool/tool.port.ts';
import { DEFAULT_AGENT_PROMPTS } from '../../../../src/app/agent/prompts/default.agent.prompts.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../../src/domain/agent/conservative.capabilities.ts';
import { type ModelCapabilities } from '../../../../src/domain/agent/model.capabilities.ts';
import { ReplayLlm } from '../../../../src/libs/llm/replay/replay.llm.ts';
import { type ReplayTurn } from '../../../../src/libs/llm/replay/replay.turn.ts';
import { type AgentEventBody } from '../../../../src/app/agent/ports/events/agent.event.body.ts';
import { makeRunnerHarness, type RunnerHarness } from '../../graph/support/runner.harness.ts';

export const TOOLS_CAPABILITIES: ModelCapabilities = { ...CONSERVATIVE_CAPABILITIES, tools: true, structuredOutput: true, contextWindow: 128_000 };

/** Ferramentas que nao existem (para nos que nao usam ferramentas). */
export const NO_TOOLS: ToolPort = {
  list: () => [],
  execute: () => Promise.reject(new Error('nenhuma ferramenta neste teste')),
};

/** Modelo que conta as chamadas e responde `reply` (ou falha com `fail`). */
export function countingLlm(reply: string, fail = false): LlmPort & { calls: number } {
  const llm = {
    calls: 0,
    capabilities: TOOLS_CAPABILITIES,
    stream() {
      llm.calls += 1;
      if (fail) return (async function* () { throw new Error('roteador fora do ar'); })();
      return (async function* () {
        yield { type: 'text_delta' as const, text: reply };
        yield { type: 'finish' as const, reason: 'stop' as const };
      })();
    },
  };
  return llm;
}

export interface NodeHarness extends RunnerHarness {
  readonly node: NodeContext;
  readonly state: AgentState;
  readonly emitted: AgentEvent[];
}

export interface NodeHarnessOptions {
  readonly userText?: string;
  readonly main?: LlmPort;
  readonly fast?: LlmPort | undefined;
  readonly fallback?: LlmPort | null;
  readonly tools?: ToolPort;
  readonly memoryTools?: ToolPort;
  readonly memory?: NodeContext['memory'];
  readonly cloud?: boolean;
  readonly state?: Partial<AgentState>;
}

/** Contexto de no completo com tudo em memoria; a execucao e as mensagens ja existem no store. */
export async function makeNodeHarness(options: NodeHarnessOptions = {}): Promise<NodeHarness> {
  const base = await makeRunnerHarness();
  const emitted: AgentEvent[] = [];
  let seq = 0;
  const main = options.main ?? new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [{ type: 'text_delta', text: 'ok' }, { type: 'finish', reason: 'stop' }] }]);
  const node: NodeContext = {
    ...base.ctx,
    assistantMessageId: 'r1-a',
    userMessageId: 'r1-u',
    llm: (role) => pickRoleLlm({ main, fast: options.fast }, role),
    fallbackLlm: () => options.fallback ?? null,
    emit: (body: AgentEventBody) => {
      seq += 1;
      const event = { ...body, runId: 'r1', conversationId: 'c1', seq } as AgentEvent;
      emitted.push(event);
      base.events.push(event);
    },
    tools: options.tools ?? NO_TOOLS,
    ...(options.memoryTools === undefined ? {} : { memoryTools: options.memoryTools }),
    ...(options.memory === undefined ? {} : { memory: options.memory }),
    cloud: options.cloud ?? false,
    contextStrategy: new SafeTruncationStrategy(),
    prompts: DEFAULT_AGENT_PROMPTS,
  };
  const text = options.userText ?? 'quanto gastei com mercado em setembro?';
  const state: AgentState = {
    ...initialAgentState('r1'),
    turnMessages: [{ role: 'user', content: [{ type: 'text', text }] }],
    ...options.state,
  };
  await base.store.messages.append({
    id: 'r1-u', conversationId: 'c1', userId: 'u1', role: 'user', parts: [{ type: 'text', text }], status: 'complete',
    runId: null, errorCode: null, createdAt: '2026-10-22T12:00:00.000Z',
  });
  await base.store.messages.append({
    id: 'r1-a', conversationId: 'c1', userId: 'u1', role: 'assistant', parts: [], status: 'streaming',
    runId: 'r1', errorCode: null, createdAt: '2026-10-22T12:00:01.000Z',
  });
  return { ...base, node, state, emitted };
}

export type { ReplayTurn };
