import { type NoticePart } from '../../../../domain/agent/notice.part.ts';
import { RunCancelledError } from '../../../../domain/agent/errors/run.cancelled.error.ts';
import { type LlmMessage } from '../../ports/llm/llm.message.ts';
import { type LlmPort } from '../../ports/llm/llm.port.ts';
import { type LlmRequest } from '../../ports/llm/llm.request.ts';
import { type AgentNodeName } from '../agent.node.name.ts';
import { type AgentState } from '../agent.state.ts';
import { defineNode } from '../define.node.ts';
import { type NodeContext } from '../node.context.ts';
import { type StepDetail } from '../step.detail.ts';
import { canFallBack } from './can.fall.back.ts';
import { composeSystem } from '../../context/compose.system.ts';
import { loadHistory } from './load.history.ts';
import { loadTurnMemory } from './load.turn.memory.ts';
import { userTextOfTurn } from './user.text.of.turn.ts';
import { redactAttachmentParts } from '../../trace/redact.attachment.parts.ts';
import { noticeOfError } from '../../errors/notice.of.error.ts';
import { fallbackUsedNotice } from '../../errors/fallback.used.notice.ts';
import { promptTools } from './prompt.tools.ts';
import { toolPortFor } from './tool.port.for.ts';
import { continueOnLength } from './continue.on.length.ts';
import { type ModelTurn } from './model.turn.ts';
import { streamModelTurn, type TurnProgress } from './stream.model.turn.ts';

/** Intervalo minimo entre gravacoes do texto parcial (em segundo plano, sem atrasar o stream). */
const PARTIAL_SAVE_MS = 500;

/** Apos tantas falhas de argumento de ferramenta o modelo passa a responder sem ferramentas. */
const MAX_ARG_FAILURES = 2;

const NO_TOOLS_NOTICE: NoticePart = {
  type: 'notice',
  kind: 'no_tools',
  text: 'Este modelo não consegue consultar os seus dados. Escolha um modelo com suporte a ferramentas nas configurações do assistente.',
};

/**
 * No `react` (spec 031, T070): uma volta de raciocinio do modelo principal. Envia as ferramentas
 * so se `capabilities.tools` (senao avisa uma vez), repassa o texto em streaming DIRETO aos eventos
 * (sem esperar gravacao) e grava o parcial em segundo plano. Falha retriavel antes de qualquer
 * conteudo -> perfil alternativo. Com chamadas de ferramenta vai para `tools`; sem, para `respond`.
 */
export const reactNode = defineNode<AgentNodeName, AgentState, NodeContext, 'tools' | 'respond'>({
  to: ['tools', 'respond'],
  async run(state, ctx) {
    const routed = ctx.selectStepLlm?.({
      node: 'react',
      intent: state.intent,
      stepIndex: state.counters.llmCalls,
      toolCallCount: state.counters.toolCalls,
      hasFailures: state.counters.argRepairAttempts > 0 || state.counters.correctionAttempts > 0,
    });
    const main = routed !== undefined ? routed.llm : ctx.llm('main').llm;
    const chosenRole = routed !== undefined ? routed.role : ('main' as const);
    const chosenTier = routed !== undefined ? routed.tier : undefined;
    const chosenModel = routed !== undefined ? routed.model : ctx.mainModel;
    const history = await loadHistory(ctx);
    const toolsEnabled = main.capabilities.tools;
    const preferenceMode = state.intent === 'preference' && ctx.memoryTools !== undefined;
    const writeMode = state.intent === 'write_request' && ctx.planTools !== undefined;
    const memory = await loadTurnMemory(ctx, userTextOfTurn(state.turnMessages), history);
    const capabilities = preferenceMode || ctx.capabilityIndex === undefined ? undefined : await ctx.capabilityIndex(ctx.userId);
    const nearBudgetLimit =
      state.usage.steps > 0 &&
      (ctx.budget.maxSteps - state.usage.steps <= 1 ||
        ctx.budget.maxMs - state.usage.ms <= 1500 ||
        (state.usage.costMicroUsd !== null && ctx.budget.maxCostMicroUsd - state.usage.costMicroUsd <= 1500));
    const baseSystem = composeSystem(ctx.prompts.system({ today: ctx.clock.now(), capabilities: main.capabilities, ...promptTools(toolPortFor(state, ctx).list()) }), { mode: preferenceMode ? ctx.prompts.preferenceMode() : writeMode ? ctx.prompts.writeMode() : undefined, capabilities, ...memory });
    const system = nearBudgetLimit
      ? `${baseSystem}\n\nAtenção: resta apenas o último passo do orçamento desta execução. Entregue agora a resposta parcial com o que já foi consultado, declare o que faltou concluir e pergunte se a pessoa quer estender o limite (nunca estenda sozinho).`
      : baseSystem;
    const messages = ctx.contextStrategy.build({ system, history, turn: state.turnMessages, capabilities: main.capabilities, ...memory });
    const forceText = state.counters.argRepairAttempts >= MAX_ARG_FAILURES || nearBudgetLimit;
    const request: LlmRequest = {
      system,
      messages,
      ...(toolsEnabled ? { tools: toolPortFor(state, ctx).list(), toolChoice: forceText ? ('none' as const) : ('auto' as const) } : {}),
      temperature: 0,
    };

    const notices = [...state.notices];
    const firstTurn = !state.turnMessages.some((m) => m.role === 'assistant' || m.role === 'tool');
    if (!toolsEnabled && firstTurn) {
      notices.push(NO_TOOLS_NOTICE);
      ctx.emit({ type: 'notice', messageId: ctx.assistantMessageId, notice: NO_TOOLS_NOTICE });
    }

    const progress: TurnProgress = { text: '', emittedContent: false };
    let lastSaveAt = ctx.clock.now().getTime();
    const onText = (text: string): void => {
      ctx.emit({ type: 'text_delta', messageId: ctx.assistantMessageId, text });
      const now = ctx.clock.now().getTime();
      if (now - lastSaveAt >= PARTIAL_SAVE_MS) {
        lastSaveAt = now;
        savePartial(ctx, progress.text);
      }
    };

    let turn: ModelTurn;
    let fallbackUsed = false;
    let activeLlm: LlmPort = main;
    const stepStartedAtMs = ctx.clock.now().getTime();
    try {
      turn = await streamModelTurn(main.stream(request, ctx.signal), progress, onText);
    } catch (error) {
      const fallback = canFallBack(error) ? ctx.fallbackLlm() : null;
      if (fallback === null) {
        await persistPartial(ctx, progress.text);
        // chave recusada/vencida ou credito esgotado: o aviso acionavel aparece na hora (e e gravado ao encerrar)
        const notice = noticeOfError(error, ctx.providerName ?? 'provedor');
        if (notice !== null) ctx.emit({ type: 'notice', messageId: ctx.assistantMessageId, notice });
        throw error;
      }
      ctx.log.warn('modelo principal falhou; usando o alternativo', { error: error instanceof Error ? error.message : String(error) });
      fallbackUsed = true;
      activeLlm = fallback;
      turn = await runFallback(fallback, request, ctx, progress, onText);
      // a troca de modelo nunca e silenciosa (spec 035, FR-011): um aviso por resposta
      if (!notices.some((n) => n.kind === 'fallback_used')) {
        const used = fallbackUsedNotice(ctx.fallbackModel ?? null);
        notices.push(used);
        ctx.emit({ type: 'notice', messageId: ctx.assistantMessageId, notice: used });
      }
    }

    let extraLlmCalls = 0;
    if (turn.finish === 'length' && turn.toolCalls.length === 0) {
      const continued = await continueOnLength({
        llm: activeLlm,
        baseRequest: request,
        initialTurn: turn,
        state,
        ctx,
        progress,
        onText,
        startedAtMs: stepStartedAtMs,
      });
      turn = continued.turn;
      extraLlmCalls = continued.extraCalls;
      if (continued.stoppedByBudget || turn.finish === 'length') {
        const cut: NoticePart = {
          type: 'notice',
          kind: 'truncated',
          text: 'A resposta atingiu o limite desta execução antes de terminar todos os itens. Quer estender o limite (ou diga "continue") para eu continuar de onde parei?',
        };
        notices.push(cut);
        ctx.emit({ type: 'notice', messageId: ctx.assistantMessageId, notice: cut });
      }
    }

    const assistant: LlmMessage = {
      role: 'assistant',
      content: turn.text === '' ? [] : [{ type: 'text', text: turn.text }],
      ...(turn.toolCalls.length > 0 ? { toolCalls: turn.toolCalls } : {}),
      ...(turn.providerState === undefined ? {} : { providerState: turn.providerState }),
    };
    const next = turn.toolCalls.length > 0 ? ('tools' as const) : ('respond' as const);
    const detail: StepDetail = {
      role: fallbackUsed ? 'fallback' : chosenRole,
      ...(chosenTier === undefined ? {} : { tier: fallbackUsed ? 'basic' : chosenTier }),
      ...(fallbackUsed && ctx.fallbackModel !== undefined && ctx.fallbackModel !== null
        ? { model: ctx.fallbackModel }
        : chosenModel === null
          ? {}
          : { model: chosenModel }),
      ...(turn.usage === null
        ? {}
        : { inputTokens: turn.usage.inputTokens, outputTokens: turn.usage.outputTokens, cachedTokens: turn.usage.cachedTokens ?? 0, costMicroUsd: turn.usage.costMicroUsd ?? null }),
      request: { system, messages: redactAttachmentParts(messages), tools: request.tools?.map((t) => t.name) ?? [] },
      response: { text: turn.text, toolCalls: turn.toolCalls.map((c) => ({ id: c.id, name: c.name, args: c.args })), finish: turn.finish },
      ...(fallbackUsed ? { fallbackUsed: true } : {}),
    };
    return {
      next,
      state: {
        ...state,
        notices,
        // no modo preferencias (confirmar o que acabou de ser dito) nao ha chip "aplicadas"
        appliedPreferenceIds: preferenceMode ? [] : memory.preferences.map((p) => p.id),
        pendingToolCalls: turn.toolCalls,
        turnMessages: [...state.turnMessages, assistant],
        finalText: turn.toolCalls.length > 0 ? state.finalText : turn.text,
        counters: { ...state.counters, llmCalls: state.counters.llmCalls + 1 + extraLlmCalls },
      },
      detail,
    };
  },
});

async function runFallback(
  fallback: LlmPort,
  request: LlmRequest,
  ctx: NodeContext,
  progress: TurnProgress,
  onText: (text: string) => void,
): Promise<ModelTurn> {
  try {
    return await streamModelTurn(fallback.stream(request, ctx.signal), progress, onText);
  } catch (error) {
    if (!(error instanceof RunCancelledError)) await persistPartial(ctx, progress.text);
    throw error;
  }
}

/** Grava o texto parcial em segundo plano; falha so vira aviso no log. */
function savePartial(ctx: NodeContext, text: string): void {
  ctx.store.messages
    .update(ctx.userId, ctx.assistantMessageId, { parts: [{ type: 'text', text }], status: 'streaming' })
    .catch((error: unknown) => {
      ctx.log.warn('falha ao salvar o texto parcial', { error: error instanceof Error ? error.message : String(error) });
    });
}

/** Ao falhar no meio, guarda o que ja saiu (aguardado: o fluxo ja esta terminando). */
async function persistPartial(ctx: NodeContext, text: string): Promise<void> {
  if (text === '') return;
  try {
    await ctx.store.messages.update(ctx.userId, ctx.assistantMessageId, { parts: [{ type: 'text', text }], status: 'streaming' });
  } catch (error) {
    ctx.log.warn('falha ao salvar o texto parcial', { error: error instanceof Error ? error.message : String(error) });
  }
}
