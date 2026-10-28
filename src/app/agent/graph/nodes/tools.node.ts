import { type Fact } from '../../../../domain/agent/fact.ts';
import { type ToolCallRecord } from '../../../../domain/agent/tool.call.record.ts';
import { type LlmMessage } from '../../ports/llm/llm.message.ts';
import { type LlmToolCall } from '../../ports/llm/llm.tool.call.ts';
import { type ToolContext } from '../../ports/tool/tool.context.ts';
import { type ToolResult } from '../../ports/tool/tool.result.ts';
import { buildToolError } from '../../tools/shared/build.tool.error.ts';
import { DEFAULT_TOOL_LIMITS } from '../../tools/default.tool.limits.ts';
import { redactFileToolArgs } from '../../trace/redact.file.tool.args.ts';
import { type AgentNodeName } from '../agent.node.name.ts';
import { type AgentState } from '../agent.state.ts';
import { defineNode } from '../define.node.ts';
import { type NodeContext } from '../node.context.ts';
import { type ToolPort } from '../../ports/tool/tool.port.ts';
import { callDerivedFacts } from './call.derived.facts.ts';
import { toolPortFor } from './tool.port.for.ts';
import { userTextOfTurn } from './user.text.of.turn.ts';

/** Maximo de chamadas de ferramenta numa execucao (alem disso o modelo recebe um aviso). */
export const MAX_TOOL_CALLS_PER_RUN = 60;

interface Executed {
  readonly call: LlmToolCall;
  readonly result: ToolResult;
  readonly ms: number;
}

/** Porta de permissao de arquivos desta execucao (spec 040): so existe quando o desktop ligou as pastas. */
function fileGateOf(ctx: NodeContext): Pick<ToolContext, 'files'> {
  if (ctx.folders === undefined) return {};
  return { files: ctx.folders.gateFor({ userId: ctx.userId, conversationId: ctx.conversationId, runId: ctx.runId, emit: ctx.emit, waited: ctx.waited, signal: ctx.signal }) };
}

async function executeOne(call: LlmToolCall, ctx: NodeContext, allowed: boolean, tools: ToolPort, turn: NonNullable<ToolContext['turn']>): Promise<Executed> {
  const startedAt = ctx.clock.now().getTime();
  let result: ToolResult;
  if (call.argsError !== undefined) {
    result = buildToolError(call.name, { code: 'invalid_args', message: `argumentos ilegiveis: ${call.argsError}`.slice(0, 240) });
  } else if (!allowed) {
    result = buildToolError(call.name, { code: 'failed', message: 'limite de consultas desta resposta atingido; responda com o que ja foi apurado' });
  } else {
    try {
      result = await tools.execute(
        { id: call.id, name: call.name, args: call.args },
        { userId: ctx.userId, now: ctx.clock.now(), locale: 'pt-BR', limits: DEFAULT_TOOL_LIMITS, source: { conversationId: ctx.conversationId, messageId: ctx.userMessageId }, cloud: ctx.cloud, turn, ...fileGateOf(ctx) },
        ctx.signal,
      );
    } catch {
      result = buildToolError(call.name, { code: 'failed', message: 'a consulta falhou' });
    }
  }
  return { call, result, ms: ctx.clock.now().getTime() - startedAt };
}

/**
 * No `tools` (spec 031, T071): executa em PARALELO as chamadas pedidas pelo modelo. Cada resultado
 * alimenta o ledger de fatos, os resumos ("Consultei: ...") e a mensagem `tool` da rodada; a falha
 * de uma nao cancela as outras (o resultado de erro volta ao modelo). Argumentos ilegiveis nao
 * executam nada: voltam como erro para o modelo tentar de novo (contador de reparos).
 */
export const toolsNode = defineNode<AgentNodeName, AgentState, NodeContext, 'react'>({
  to: ['react'],
  async run(state, ctx) {
    const calls = state.pendingToolCalls;
    const room = Math.max(0, MAX_TOOL_CALLS_PER_RUN - state.counters.toolCalls);
    const port = toolPortFor(state, ctx);
    const turn = {
      runId: ctx.runId,
      assistantMessageId: ctx.assistantMessageId,
      userText: userTextOfTurn(state.turnMessages),
      knownMoneyCents: state.ledger.filter((f) => f.kind === 'money' && typeof f.value === 'number' && f.external !== true).map((f) => f.value as number),
      ledger: state.ledger,
    };
    const executed = await Promise.all(calls.map((call, index) => executeOne(call, ctx, index < room, port, turn)));

    const facts: Fact[] = [];
    const summaries = [...state.summaries];
    const messages: LlmMessage[] = [];
    const planIds = [...state.planIds];
    const capabilityRequestIds = [...state.capabilityRequestIds];
    const reports = [...state.reports];
    const records: ToolCallRecord[] = [];
    let argFailures = 0;
    for (const { call, result, ms } of executed) {
      facts.push(...result.facts, ...callDerivedFacts(call.id, call.args, result));
      messages.push({ role: 'tool', toolCallId: call.id, content: result.contentForModel });
      if (result.ok && result.hidden !== true) {
        summaries.push(result.summary);
        ctx.emit({ type: 'query_card', messageId: ctx.assistantMessageId, summary: result.summary });
      }
      if (result.ok && result.plan !== undefined) {
        if (!planIds.includes(result.plan.planId)) planIds.push(result.plan.planId);
        ctx.emit({ type: 'plan_updated', messageId: ctx.assistantMessageId, planId: result.plan.planId, status: result.plan.status });
      }
      if (result.ok && result.report !== undefined && !reports.some((r) => r.path === result.report?.path)) {
        reports.push(result.report);
        ctx.emit({ type: 'report_saved', messageId: ctx.assistantMessageId, path: result.report.path, format: result.report.format });
      }
      for (const requestId of result.capabilityRequestIds ?? []) {
        if (capabilityRequestIds.includes(requestId)) continue;
        capabilityRequestIds.push(requestId);
        ctx.emit({ type: 'capability_requested', messageId: ctx.assistantMessageId, requestId });
      }
      if (call.argsError !== undefined || result.error?.code === 'invalid_args') argFailures += 1;
      records.push({
        id: call.id,
        name: call.name,
        args: redactFileToolArgs(call.name, call.args),
        resultSummary: result.ok ? `${result.summary.label} (${result.summary.itemCount} itens)` : `erro: ${result.error?.message ?? 'falhou'}`,
        ms,
        truncated: result.summary.truncated,
        ...(result.external === undefined ? {} : { external: result.external }),
      });
    }
    return {
      next: 'react' as const,
      state: {
        ...state,
        pendingToolCalls: [],
        turnMessages: [...state.turnMessages, ...messages],
        ledger: [...state.ledger, ...facts],
        summaries,
        planIds,
        capabilityRequestIds,
        reports,
        counters: { ...state.counters, toolCalls: state.counters.toolCalls + calls.length, argRepairAttempts: state.counters.argRepairAttempts + argFailures },
      },
      detail: { toolCalls: records },
    };
  },
});
