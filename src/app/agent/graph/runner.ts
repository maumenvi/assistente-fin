import { AgentError } from '../../../domain/agent/errors/agent.error.ts';
import { RunCancelledError } from '../../../domain/agent/errors/run.cancelled.error.ts';
import { addConsumed } from '../../../domain/agent/add.consumed.ts';
import { type Consumed } from '../../../domain/agent/consumed.ts';
import { calculateStepCost } from '../../../domain/agent/pricing/calculate.step.cost.ts';
import { resolveModelPricing } from '../../../domain/agent/pricing/resolve.model.pricing.ts';
import { tierOfRole } from '../../../domain/agent/routing/role.of.tier.ts';
import { type RunStep } from '../../../domain/agent/run.step.ts';
import { type AgentEvent } from '../ports/events/agent.event.ts';
import { type AgentEventBody } from '../ports/events/agent.event.body.ts';
import { emitSafely } from '../trace/emit.safely.ts';
import { redactAgentState } from '../trace/redact.agent.state.ts';
import { type AgentState } from './agent.state.ts';
import { END } from './end.ts';
import { type Graph, type LimitReason } from './graph.ts';
import { type RunOutcome } from './run.outcome.ts';
import { type RunnerContext } from './runner.context.ts';
import { type StepDetail } from './step.detail.ts';

/** Qual limite do orcamento ja estourou (passos, tokens, tempo ou custo), ou `null`. */
function exceededLimit(ctx: RunnerContext, usage: Consumed, elapsedMs: number): LimitReason | null {
  if (usage.steps >= ctx.budget.maxSteps) return 'steps';
  if (ctx.budget.maxTokens !== undefined && usage.inputTokens + usage.outputTokens >= ctx.budget.maxTokens) {
    return 'tokens';
  }
  if (elapsedMs >= ctx.budget.maxMs) return 'time';
  if (usage.costMicroUsd !== null && usage.costMicroUsd >= ctx.budget.maxCostMicroUsd) return 'cost';
  return null;
}

function resolveStepCost(ctx: RunnerContext, detail: StepDetail | undefined): number | null {
  if (detail?.costMicroUsd !== undefined && detail.costMicroUsd !== null) return detail.costMicroUsd;
  if (ctx.metricProfiles === undefined) return detail?.costMicroUsd ?? null;
  const inputTokens = detail?.inputTokens ?? 0;
  const outputTokens = detail?.outputTokens ?? 0;
  if (inputTokens === 0 && outputTokens === 0) return detail?.costMicroUsd ?? null;
  const role = detail?.role ?? 'main';
  const profile =
    role === 'fast'
      ? (ctx.metricProfiles.fast ?? ctx.metricProfiles.main)
      : role === 'fallback'
        ? (ctx.metricProfiles.fallback ?? ctx.metricProfiles.main)
        : ctx.metricProfiles.main;
  const pricing = resolveModelPricing(profile.origin, detail?.model ?? profile.model, profile.pricing);
  return calculateStepCost({ inputTokens, outputTokens }, pricing);
}

function consumedOfStep(ctx: RunnerContext, detail: StepDetail | undefined, durationMs: number): Consumed {
  return {
    steps: 1,
    ms: durationMs,
    inputTokens: detail?.inputTokens ?? 0,
    outputTokens: detail?.outputTokens ?? 0,
    cachedTokens: detail?.cachedTokens ?? 0,
    costMicroUsd: resolveStepCost(ctx, detail),
  };
}

/**
 * Executa um grafo (spec 031, contracts/agent.graph.md). Por passo: confere orcamento e
 * cancelamento, executa o no, valida a transicao, grava o passo no trace (sem esperar), publica os
 * eventos de UI e salva o checkpoint SEM aguardar. No fim grava o estado final AGUARDANDO antes de
 * publicar `run_finished`. Nunca lanca: falha vira `status: 'failed'`; cancelamento, `cancelled`.
 */
export async function runGraph<N extends string, S extends AgentState, C extends RunnerContext>(
  graph: Graph<N, S, C>,
  initial: S,
  ctx: C,
  startNode?: N,
): Promise<RunOutcome<S>> {
  const startedAtMs = ctx.clock.now().getTime();
  const baseMs = initial.usage.ms;
  // tempo esperando a pessoa decidir (pasta, edicao): nao conta no orcamento de tempo (spec 040)
  const waited = (): number => ctx.waited?.ms ?? 0;
  let eventSeq = 0;
  let stepSeq = 0;
  let state = initial;
  let node: N | typeof END = startNode ?? graph.start;
  let model = ctx.mainModel;
  let fallbackUsed = ctx.profileIds.fallbackUsed ?? false;
  let limit: LimitReason | null = null;
  let failure: Error | null = null;
  let previous: string | null = null;

  const publish = (body: AgentEventBody): void => {
    eventSeq += 1;
    ctx.events.publish({ ...body, runId: ctx.runId, conversationId: ctx.conversationId, seq: eventSeq } as AgentEvent);
  };

  // Os nos publicam pelo mesmo contador de `seq` do runner (`ctx.emit`).
  const nodeCtx = { ...ctx, emit: publish } as unknown as C;

  try {
    while (node !== END) {
      const elapsed = ctx.clock.now().getTime() - startedAtMs + baseMs - waited();
      const exceeded = exceededLimit(ctx, state.usage, elapsed);
      if (exceeded !== null) {
        limit = exceeded;
        if (graph.onLimit) state = await graph.onLimit(state, exceeded, nodeCtx);
        break;
      }
      if (ctx.signal.aborted) throw new RunCancelledError();
      const current: N = node;
      publish({ type: 'node_started', node: current });
      const stepStartedAt = ctx.clock.now();
      const waitedAtStart = waited();
      let result;
      try {
        result = await graph.nodes[current].run(state, nodeCtx);
      } catch (error) {
        stepSeq += 1;
        emitSafely(ctx.trace, {
          type: 'step',
          userId: ctx.userId,
          step: buildStep(ctx, current, previous, stepSeq, null, stepStartedAt, ctx.clock.now().getTime() - stepStartedAt.getTime(), undefined, error),
        });
        throw error;
      }
      if (!graph.nodes[current].to.includes(result.next)) {
        throw new Error(`transicao invalida: "${current}" -> "${String(result.next)}"`);
      }
      const durationMs = Math.max(0, ctx.clock.now().getTime() - stepStartedAt.getTime() - (waited() - waitedAtStart));
      const stepConsumed = consumedOfStep(ctx, result.detail, durationMs);
      const enrichedDetail: StepDetail | undefined =
        result.detail === undefined
          ? undefined
          : { ...result.detail, costMicroUsd: stepConsumed.costMicroUsd };
      state = { ...result.state, usage: addConsumed(state.usage, stepConsumed) };
      if (result.detail?.role === 'main' && result.detail.model !== undefined) model = result.detail.model;
      if (result.detail?.fallbackUsed) fallbackUsed = true;
      stepSeq += 1;
      const step = buildStep(ctx, current, previous, stepSeq, result.next, stepStartedAt, durationMs, enrichedDetail, undefined);
      emitSafely(ctx.trace, { type: 'step', userId: ctx.userId, step });
      recordStepMetricInBackground(ctx, current, stepStartedAt, durationMs, enrichedDetail);
      publish({
        type: 'step_recorded',
        step: {
          seq: step.seq, node: step.node, status: 'ok', durationMs, model: step.model, inputTokens: step.inputTokens,
          outputTokens: step.outputTokens, costMicroUsd: step.costMicroUsd, toolNames: step.toolCalls.map((c) => c.name),
        },
      });
      publish({ type: 'usage', consumed: state.usage });
      publish({ type: 'node_finished', node: current, next: result.next, durationMs });
      saveCheckpointInBackground(ctx, state, result.next === END ? null : result.next, model, fallbackUsed);
      previous = current;
      node = result.next;
    }
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    if (!(failure instanceof AgentError)) ctx.log.error('execucao do agente falhou', { error: failure.message });
  }

  const status: RunOutcome<S>['status'] = failure === null ? 'done' : failure instanceof RunCancelledError ? 'cancelled' : 'failed';
  const totalMs = ctx.clock.now().getTime() - startedAtMs + baseMs - waited();
  const finalUsage: Consumed = { ...state.usage, ms: Math.max(state.usage.ms, totalMs) };
  state = { ...state, usage: finalUsage };
  const errorCode = failure === null ? (limit === null ? null : 'BUDGET_EXCEEDED') : failure instanceof AgentError ? failure.code : 'INTERNAL';
  try {
    await ctx.store.runs.finish(ctx.userId, ctx.runId, {
      status, endedAt: ctx.clock.now().toISOString(), errorCode, consumed: finalUsage, state: redactAgentState(state),
    });
  } catch (error) {
    ctx.log.error('falha ao gravar o estado final da execucao', { error: error instanceof Error ? error.message : String(error) });
  }
  emitSafely(ctx.trace, {
    type: 'run_finished', userId: ctx.userId, runId: ctx.runId, conversationId: ctx.conversationId, status, consumed: finalUsage,
    durationMs: totalMs, errorCode,
  });
  publish({
    type: 'run_finished',
    status,
    ...(failure === null ? {} : { error: { code: errorCode ?? 'INTERNAL', message: failure instanceof AgentError ? failure.message : 'erro interno inesperado' } }),
  });
  return { status, state, limit, error: failure };
}

/**
 * Modelo de um passo que chamou o LLM mas nao informou qual (ex.: resposta direta): vem do perfil do
 * papel usado (spec 040, FR-002). Passo sem LLM (`role` ausente) fica sem modelo.
 */
function modelOfRole(ctx: RunnerContext, role: StepDetail['role']): string | null {
  if (role === undefined) return null;
  const profiles = ctx.metricProfiles;
  const profile = role === 'fast' ? (profiles?.fast ?? profiles?.main) : role === 'fallback' ? (profiles?.fallback ?? profiles?.main) : profiles?.main;
  return profile?.model ?? ctx.mainModel;
}

function buildStep(
  ctx: RunnerContext,
  node: string,
  from: string | null,
  seq: number,
  next: string | null,
  startedAt: Date,
  durationMs: number,
  detail: StepDetail | undefined,
  error: unknown,
): RunStep {
  const failed = error !== undefined;
  const cancelled = error instanceof RunCancelledError;
  return {
    id: ctx.ids.next(),
    runId: ctx.runId,
    seq,
    node,
    fromNode: from,
    toNode: next,
    status: failed ? (cancelled ? 'cancelled' : 'error') : 'ok',
    startedAt: startedAt.toISOString(),
    durationMs,
    role: detail?.role ?? null,
    model: detail?.model ?? modelOfRole(ctx, detail?.role),
    inputTokens: detail?.inputTokens ?? null,
    outputTokens: detail?.outputTokens ?? null,
    cachedTokens: detail?.cachedTokens ?? null,
    costMicroUsd: detail?.costMicroUsd ?? null,
    toolCalls: detail?.toolCalls ?? [],
    request: detail?.request ?? null,
    response: detail?.response ?? null,
    truncated: false,
    error: failed
      ? { code: error instanceof AgentError ? error.code : 'INTERNAL', message: error instanceof AgentError ? error.message : 'erro interno inesperado' }
      : null,
  };
}

/** Salva o checkpoint sem aguardar (FR-016): falha vira log e a execucao segue. */
function saveCheckpointInBackground(ctx: RunnerContext, state: AgentState, currentNode: string | null, model: string | null, fallbackUsed: boolean): void {
  try {
    void ctx.store.runs
      .saveCheckpoint(ctx.userId, ctx.runId, {
        currentNode,
        intent: state.intent,
        consumed: state.usage,
        profileIds: { main: ctx.profileIds.main, fast: ctx.profileIds.fast, fallbackUsed },
        model,
        state: redactAgentState(state),
        heartbeatAt: ctx.clock.now().toISOString(),
      })
      .catch((error: unknown) => {
        ctx.log.warn('falha ao salvar o checkpoint', { error: error instanceof Error ? error.message : String(error) });
      });
  } catch (error) {
    ctx.log.warn('falha ao salvar o checkpoint', { error: error instanceof Error ? error.message : String(error) });
  }
}

/** Grava telemetria permanente da chamada de LLM sem bloquear o passo (spec 038, FR-019). */
function recordStepMetricInBackground(
  ctx: RunnerContext,
  node: string,
  startedAt: Date,
  durationMs: number,
  detail: StepDetail | undefined,
): void {
  if (detail === undefined) return;
  const hasTokens = (detail.inputTokens ?? 0) > 0 || (detail.outputTokens ?? 0) > 0;
  if (!hasTokens && detail.model === undefined) return;
  if (ctx.store.metrics === undefined) return;

  try {
    const role = detail.role ?? 'main';
    const tier = detail.tier ?? tierOfRole(role);
    const mainProfile = ctx.metricProfiles?.main;
    const activeProfile =
      role === 'fast'
        ? (ctx.metricProfiles?.fast ?? mainProfile)
        : role === 'fallback'
          ? (ctx.metricProfiles?.fallback ?? mainProfile)
          : mainProfile;
    const model = detail.model ?? activeProfile?.model ?? ctx.mainModel ?? 'unknown';
    const origin = activeProfile?.origin ?? 'openrouter';
    const inputTokens = detail.inputTokens ?? 0;
    const outputTokens = detail.outputTokens ?? 0;
    const cachedTokens = detail.cachedTokens ?? 0;

    const activePricing = resolveModelPricing(origin, model, activeProfile?.pricing);
    const costMicroUsd =
      detail.costMicroUsd !== undefined && detail.costMicroUsd !== null
        ? detail.costMicroUsd
        : calculateStepCost({ inputTokens, outputTokens }, activePricing);

    const highModel = mainProfile?.model ?? ctx.mainModel ?? model;
    const highOrigin = mainProfile?.origin ?? origin;
    const highPricing = resolveModelPricing(highOrigin, highModel, mainProfile?.pricing);
    const baselineHighCostMicroUsd =
      tier === 'high' && detail.costMicroUsd !== undefined && detail.costMicroUsd !== null
        ? detail.costMicroUsd
        : calculateStepCost({ inputTokens, outputTokens }, highPricing);

    void ctx.store.metrics
      .append({
        id: ctx.ids.next(),
        userId: ctx.userId,
        runId: ctx.runId,
        conversationId: ctx.conversationId,
        strategy: ctx.routingStrategy ?? 'hybrid_3_tiers',
        tier,
        role,
        model,
        origin,
        node,
        inputTokens,
        outputTokens,
        cachedTokens,
        costMicroUsd,
        baselineHighCostMicroUsd: Math.max(costMicroUsd, baselineHighCostMicroUsd),
        durationMs,
        status: 'ok',
        createdAt: startedAt.toISOString(),
      })
      .catch(() => undefined);
  } catch {
    // falha de telemetria nunca interrompe a execucao
  }
}
