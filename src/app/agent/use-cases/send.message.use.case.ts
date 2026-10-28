import { z } from 'zod';
import { type AgentRun } from '../../../domain/agent/agent.run.ts';
import { canContinueRun } from '../../../domain/agent/can.continue.run.ts';
import { DEFAULT_MAX_TOKENS } from '../../../domain/agent/default.run.budget.ts';
import { AgentError } from '../../../domain/agent/errors/agent.error.ts';
import { NoFallbackConfiguredError } from '../../../domain/agent/errors/no.fallback.configured.error.ts';
import { NothingToRetryError } from '../../../domain/agent/errors/nothing.to.retry.error.ts';
import { RunAlreadyActiveError } from '../../../domain/agent/errors/run.already.active.error.ts';
import { RunNotContinuableError } from '../../../domain/agent/errors/run.not.continuable.error.ts';
import { type LlmTier } from '../../../domain/agent/routing/llm.tier.ts';
import { selectTierForStep } from '../../../domain/agent/routing/select.tier.for.step.ts';
import { type RunBudget } from '../../../domain/agent/run.budget.ts';
import { EMPTY_CONSUMED } from '../../../domain/agent/empty.consumed.ts';
import { makeConversationTitle } from '../../../domain/agent/make.conversation.title.ts';
import { redactAgentState } from '../trace/redact.agent.state.ts';
import { assertAttachmentGates } from '../attachment/gate/check.attachment.gates.ts';
import { attachmentTextBudget } from '../attachment/model/attachment.text.budget.ts';
import { imageWindow, MAX_IMAGES_IN_CONTEXT } from '../attachment/model/image.window.ts';
import { attachmentFacts } from '../attachment/model/attachment.facts.ts';
import { buildAttachmentContent } from '../attachment/model/build.attachment.content.ts';
import { type AttachmentDraftStore } from '../attachment/draft/attachment.draft.store.ts';
import { type AttachmentPart } from '../../../domain/agent/attachment/attachment.part.ts';
import { ContextTooSmallForAttachmentError } from '../../../domain/agent/attachment/errors/context.too.small.for.attachment.error.ts';
import { StorageFullError } from '../../../domain/agent/attachment/errors/storage.full.error.ts';
import { type LlmContentPart } from '../ports/llm/llm.content.part.ts';
import { noticeOfError } from '../errors/notice.of.error.ts';
import { providerNameOfProfile } from '../errors/provider.name.of.profile.ts';
import { requiresCloudConsent } from '../../../domain/agent/requires.cloud.consent.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { GatedAgentEvents } from '../events/gated.agent.events.ts';
import { initialAgentState } from '../graph/initial.agent.state.ts';
import { type AgentNodeName } from '../graph/agent.node.name.ts';
import { type AgentState } from '../graph/agent.state.ts';
import { type NodeContext, type RoutedStepLlm } from '../graph/node.context.ts';
import { runGraph } from '../graph/runner.ts';
import { buildRoleLlms } from '../llm/build.role.llms.ts';
import { type RoleLlms } from '../llm/role.llms.ts';
import { pickRoleLlm } from '../llm/pick.role.llm.ts';
import { type AgentSettings } from '../ports/settings/agent.settings.ts';
import { continueRunInputSchema } from './continue.run.input.schema.ts';
import { type SendMessageDeps } from './send.message.deps.ts';
import { rerunInputSchema } from './rerun.input.schema.ts';
import { sendMessageInputSchema } from './send.message.input.schema.ts';
import { type SendMessageResult } from './send.message.result.ts';

/** Quantas mensagens recentes sao lidas para achar a ultima resposta a refazer. */
const RERUN_LOOKBACK = 20;

const EXTEND_BUDGET_REPLY = /^(sim|s|pode( sim| continuar| estender| terminar)?|quero( sim)?|estend\w*|continue|continua|continuar)\b/i;

/**
 * Enviar uma pergunta ao agente (spec 031, T077, FR-018). Pontos SINCRONOS (aguardados): valida o
 * texto, exige o modelo principal e o consentimento antes de qualquer rede, cria/obtem a conversa e
 * grava a pergunta, a mensagem do assistente (em streaming) e a execucao. Devolve na hora
 * `{ conversationId, runId }`; o grafo roda em segundo plano e a resposta chega por eventos. Uma
 * execucao ativa por conversa.
 */
export class SendMessageUseCase {
  private readonly deps: SendMessageDeps;

  public constructor(deps: SendMessageDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<SendMessageResult> {
    const parsed = sendMessageInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('enviar mensagem ao agente', flat.fieldErrors, flat.formErrors);
    }
    const { userId, text } = parsed.data;
    const { store, clock, ids, runs } = this.deps;
    runs.assertCapacity();

    const settings = await this.deps.settings.read(userId);
    const models = await this.models(userId, settings);
    const draftIds = parsed.data.attachmentIds ?? [];
    if (draftIds.length > 0 && this.deps.drafts === undefined) throw new InvalidInputError('enviar mensagem ao agente', { attachmentIds: ['anexos nao estao disponiveis aqui'] });
    // confere TUDO antes de consumir os rascunhos (spec 036): rascunhos validos e janela do modelo com espaco para o anexo
    const peeked = this.deps.drafts === undefined ? [] : draftIds.map((id) => (this.deps.drafts as AttachmentDraftStore).get(userId, id));
    assertAttachmentGates({
      localOnly: settings.localOnly,
      cloud: [models.mainProfile, models.fastProfile, models.fallbackProfile].some((profile) => profile !== null && requiresCloudConsent(profile.origin)),
      vision: models.main.capabilities.vision,
      contextWindow: models.main.capabilities.contextWindow,
      consent: peeked.length === 0 ? null : await this.deps.settings.readConsent(userId, 'attachments'),
      drafts: peeked,
    });

    const now = clock.now().toISOString();
    let conversationId = parsed.data.conversationId;
    if (conversationId === undefined) {
      conversationId = ids.next();
      await store.conversations.create({
        id: conversationId, userId, title: makeConversationTitle(text), status: 'active', createdAt: now, updatedAt: now, lastMessageAt: now,
      });
    } else {
      const existing = await store.conversations.get(userId, conversationId);
      if (existing === null || existing.status !== 'active') throw new InvalidInputError('enviar mensagem ao agente', { conversationId: ['conversa nao encontrada'] });
      if (runs.hasConversation(conversationId)) throw new RunAlreadyActiveError();
    }

    const userMessageId = ids.next();
    const attachmentParts = await this.saveAttachments(userId, conversationId, userMessageId, draftIds, now, parsed.data.conversationId === undefined);
    try {
      await store.messages.append({
        id: userMessageId, conversationId, userId, role: 'user', parts: [{ type: 'text', text }, ...attachmentParts], status: 'complete', runId: null, errorCode: null, createdAt: now,
      });
    } catch (error) {
      await store.attachments.deleteByConversation(userId, conversationId).catch(() => 0);
      throw error;
    }
    return this.launch({ userId, conversationId, text, userMessageId, settings, models, fallbackForced: false, now });
  }

  /**
   * Consome os rascunhos e grava os anexos ligados a mensagem (spec 036). Falha de gravacao (sem espaco) vira `StorageFullError`
   * e, numa conversa recem-criada, ela e desfeita: nada fica pela metade.
   */
  private async saveAttachments(userId: string, conversationId: string, messageId: string, draftIds: readonly string[], now: string, newConversation: boolean): Promise<AttachmentPart[]> {
    const { drafts, store, ids } = this.deps;
    if (draftIds.length === 0 || drafts === undefined) return [];
    const taken = drafts.take(userId, draftIds);
    const parts: AttachmentPart[] = [];
    try {
      for (const draft of taken) {
        // o anexo guardado herda o id do rascunho: o cartao da mensagem recem-enviada ja abre o anexo certo
        const id = draft.draftId;
        await store.attachments.save({ id, userId, conversationId, messageId, name: draft.name, kind: draft.kind, mediaType: draft.mediaType, sizeBytes: draft.sizeBytes, status: 'ready', extracted: draft.extracted, bytes: draft.bytes, createdAt: now });
        parts.push({ type: 'attachment', attachmentId: id, name: draft.name, kind: draft.kind, sizeBytes: draft.sizeBytes, available: true });
      }
    } catch {
      await store.attachments.deleteByConversation(userId, conversationId).catch(() => 0);
      if (newConversation) await store.conversations.delete(userId, conversationId).catch(() => undefined);
      throw new StorageFullError();
    }
    return parts;
  }

  /** Conteudo do turno: texto + blocos de dado externo dos anexos (e imagens, se o modelo enxerga), dimensionado pela janela do modelo. */
  private async turnContent(userId: string, conversationId: string, messageId: string, text: string, models: RoleLlms): Promise<LlmContentPart[]> {
    const attachments = await this.deps.store.attachments.listByMessage(userId, messageId);
    if (attachments.length === 0) return [{ type: 'text', text }];
    const caps = models.main.capabilities;
    // imagens: as desta mensagem e as das 2 mensagens com anexo anteriores, no maximo 3 no contexto (spec 036)
    const windowImages = caps.vision ? imageWindow(await this.deps.store.attachments.listByConversation(userId, conversationId), messageId) : [];
    const images = windowImages.length;
    const recent = await this.deps.store.messages.list(userId, conversationId, { limit: 40 });
    const historyTokens = Math.ceil(recent.filter((m) => m.id !== messageId).reduce((sum, m) => sum + m.parts.reduce((s, p) => s + (p.type === 'text' ? p.text.length : 0), 0), 0) / 3);
    const budget = attachmentTextBudget(caps.contextWindow, { historyTokens, imageCount: caps.vision ? images : 0 });
    if (budget === null) throw new ContextTooSmallForAttachmentError();
    const files = attachments.filter((a) => a.kind !== 'image');
    const ownImages = attachments.filter((a) => a.kind === 'image').length;
    const dropped = caps.vision ? Math.max(0, ownImages - MAX_IMAGES_IN_CONTEXT) : 0;
    const built = buildAttachmentContent([...windowImages, ...files], budget, caps.vision);
    const note = dropped > 0 ? `(${dropped} imagem(ns) além do limite de ${MAX_IMAGES_IN_CONTEXT} no contexto não foram enviadas)` : '';
    const extra = [built.text, note].filter((part) => part !== '').join('\n');
    // o texto do arquivo vai em parte propria: roteamento, memoria e verificacao leem so a pergunta do usuario (primeira parte)
    return [{ type: 'text', text }, ...(extra === '' ? [] : [{ type: 'text' as const, text: extra }]), ...built.images];
  }

  /**
   * Refaz a resposta da ULTIMA mensagem do assistente quando ela terminou `interrupted` ou `error`
   * (spec 031, T115): nova execucao ligada a MESMA pergunta do usuario - a pergunta nao se duplica e
   * a mensagem original permanece. Com `useFallback`, forca o perfil alternativo.
   */
  public async rerun(rawInput: unknown): Promise<SendMessageResult> {
    const parsed = rerunInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('tentar de novo', flat.fieldErrors, flat.formErrors);
    }
    const { userId, conversationId, messageId, useFallback } = parsed.data;
    const { store, clock, runs } = this.deps;
    const conversation = await store.conversations.get(userId, conversationId);
    if (conversation === null || conversation.status !== 'active') throw new InvalidInputError('tentar de novo', { conversationId: ['conversa nao encontrada'] });
    if (runs.hasConversation(conversationId)) throw new RunAlreadyActiveError();
    runs.assertCapacity();

    const messages = await store.messages.list(userId, conversationId, { limit: RERUN_LOOKBACK });
    const last = messages.at(-1);
    const question = messages.at(-2);
    const retriable = last?.role === 'assistant' && (last.status === 'interrupted' || last.status === 'error');
    if (last === undefined || last.id !== messageId || !retriable || question?.role !== 'user') throw new NothingToRetryError();
    const text = question.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('');

    const settings = await this.deps.settings.read(userId);
    const models = await this.models(userId, settings);
    const forced = useFallback ? this.forceFallback(models) : models;
    return this.launch({ userId, conversationId, text, userMessageId: question.id, settings, models: forced, fallbackForced: useFallback, now: clock.now().toISOString() });
  }

  /**
   * Retoma uma execucao pausada por limite de passos/tokens/orcamento do ponto exato onde parou
   * (spec 038, FR-009), preservando o checkpoint (`turnMessages`, `ledger`, `summaries`) e somando
   * um novo lote de passos e tokens ao orcamento.
   */
  public async continueRun(rawInput: unknown): Promise<SendMessageResult> {
    const parsed = continueRunInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('continuar execucao', flat.fieldErrors, flat.formErrors);
    }
    const { userId, runId: previousRunId, extraSteps, extraTokens } = parsed.data;
    const { store, clock, ids, runs } = this.deps;

    const previousRun = await store.runs.get(userId, previousRunId);
    if (previousRun === null || !canContinueRun(previousRun)) {
      throw new RunNotContinuableError();
    }
    if (runs.hasConversation(previousRun.conversationId)) {
      throw new RunAlreadyActiveError();
    }
    runs.assertCapacity();

    const settings = await this.deps.settings.read(userId);
    const models = await this.models(userId, settings);
    const now = clock.now().toISOString();
    const rawSaved = (previousRun.state ?? initialAgentState(previousRunId)) as AgentState;
    const newRunId = ids.next();

    const cleanedState: AgentState = {
      ...rawSaved,
      runId: newRunId,
      notices: (rawSaved.notices ?? []).filter((n) => n.kind !== 'budget_reached' && n.kind !== 'truncated'),
    };

    const startNode: AgentNodeName =
      cleanedState.intent === null
        ? 'route'
        : cleanedState.pendingToolCalls.length > 0
          ? 'tools'
          : 'react';

    const baseLimits = models.mainProfile.limits ?? settings.limits;
    const addSteps = extraSteps ?? baseLimits.maxSteps;
    const addTokens = extraTokens ?? baseLimits.maxTokens ?? DEFAULT_MAX_TOKENS;
    const prevMaxTokens = previousRun.budget.maxTokens;
    const extendedBudget: RunBudget = {
      maxSteps: previousRun.budget.maxSteps + addSteps,
      maxMs: previousRun.budget.maxMs + baseLimits.maxMs,
      maxCostMicroUsd: previousRun.budget.maxCostMicroUsd + baseLimits.maxCostMicroUsd,
      ...(prevMaxTokens !== undefined || extraTokens !== undefined || baseLimits.maxTokens !== undefined
        ? { maxTokens: (prevMaxTokens ?? baseLimits.maxTokens ?? DEFAULT_MAX_TOKENS) + addTokens }
        : {}),
    };

    await store.messages.update(userId, previousRun.assistantMessageId, {
      status: 'streaming',
      errorCode: null,
    });

    const continuedRun: AgentRun = {
      id: newRunId,
      conversationId: previousRun.conversationId,
      userId,
      userMessageId: previousRun.userMessageId,
      assistantMessageId: previousRun.assistantMessageId,
      status: 'running',
      currentNode: startNode,
      intent: cleanedState.intent,
      budget: extendedBudget,
      consumed: cleanedState.usage,
      profileIds: previousRun.profileIds,
      model: models.mainProfile.model,
      state: redactAgentState(cleanedState),
      startedAt: now,
      endedAt: null,
      heartbeatAt: now,
      errorCode: null,
    };
    await store.runs.create(continuedRun);
    await store.conversations.touch(userId, previousRun.conversationId, now);

    const controller = new AbortController();
    const active = {
      runId: newRunId,
      conversationId: previousRun.conversationId,
      userId,
      controller,
      settled: Promise.resolve(),
    };
    runs.register(active);
    this.deps.events.publish({
      type: 'run_started',
      runId: newRunId,
      conversationId: previousRun.conversationId,
      seq: 0,
      userMessageId: previousRun.userMessageId,
      assistantMessageId: previousRun.assistantMessageId,
    });
    active.settled = this.runInBackground(continuedRun, cleanedState, models, settings, controller.signal, startNode).finally(() =>
      runs.release(newRunId),
    );
    return { conversationId: previousRun.conversationId, runId: newRunId };
  }

  /** Monta os modelos da execucao: principal obrigatorio e consentimento conferidos antes de qualquer rede. */
  private async models(userId: string, settings: AgentSettings): Promise<RoleLlms> {
    const consent = await this.deps.settings.readConsent(userId);
    return buildRoleLlms(settings, consent, this.deps.consentTextVersion, this.deps.makeLlm);
  }

  /** O perfil alternativo passa a ser o principal desta execucao. */
  private forceFallback(models: RoleLlms): RoleLlms {
    if (models.fallback === null || models.fallbackProfile === null) throw new NoFallbackConfiguredError();
    return { ...models, main: models.fallback, mainProfile: models.fallbackProfile, fallback: null, fallbackProfile: null };
  }

  /** Cria a mensagem do assistente e a execucao (aguardado) e inicia o grafo em segundo plano. */
  private async launch(args: {
    readonly userId: string;
    readonly conversationId: string;
    readonly text: string;
    readonly userMessageId: string;
    readonly settings: AgentSettings;
    readonly models: RoleLlms;
    readonly fallbackForced: boolean;
    readonly now: string;
  }): Promise<SendMessageResult> {
    const { userId, conversationId, text, userMessageId, settings, models, now } = args;
    const { store, ids, runs } = this.deps;
    const priorMessages = await store.messages.list(userId, conversationId, { limit: 4 });
    const lastAssistant = [...priorMessages].reverse().find((m) => m.role === 'assistant');
    const lastHitBudget =
      lastAssistant?.parts.some((p) => p.type === 'notice' && (p.kind === 'budget_reached' || p.kind === 'truncated')) ?? false;
    const extendBudget = lastHitBudget && EXTEND_BUDGET_REPLY.test(text.trim());
    const effectiveLimits = models.mainProfile.limits ?? settings.limits;
    const runBudget: RunBudget = extendBudget
      ? {
          maxSteps: effectiveLimits.maxSteps * 2,
          maxMs: effectiveLimits.maxMs * 2,
          maxCostMicroUsd: effectiveLimits.maxCostMicroUsd * 2,
          ...(effectiveLimits.maxTokens === undefined ? {} : { maxTokens: effectiveLimits.maxTokens * 2 }),
        }
      : effectiveLimits;
    const content = await this.turnContent(userId, conversationId, userMessageId, text, models);
    const runId = ids.next();
    const assistantMessageId = ids.next();
    await store.messages.append({
      id: assistantMessageId, conversationId, userId, role: 'assistant', parts: [], status: 'streaming', runId, errorCode: null, createdAt: now,
    });
    const state = {
      ...initialAgentState(runId),
      ledger: attachmentFacts(await store.attachments.listByMessage(userId, userMessageId)),
      turnMessages: [{ role: 'user' as const, content }],
    };
    const run: AgentRun = {
      id: runId, conversationId, userId, userMessageId, assistantMessageId, status: 'running', currentNode: null, intent: null,
      budget: runBudget, consumed: EMPTY_CONSUMED,
      profileIds: { main: models.mainProfile.id, fast: models.fastProfile?.id ?? null, fallbackUsed: args.fallbackForced },
      model: models.mainProfile.model, state: redactAgentState(state), startedAt: now, endedAt: null, heartbeatAt: now, errorCode: null,
    };
    await store.runs.create(run);
    await store.conversations.touch(userId, conversationId, now);

    const controller = new AbortController();
    const active = { runId, conversationId, userId, controller, settled: Promise.resolve() };
    runs.register(active);
    this.deps.events.publish({ type: 'run_started', runId, conversationId, seq: 0, userMessageId, assistantMessageId });
    this.deps.trace.emit({ type: 'run_started', userId, run: { ...run, question: text.split('\n')[0] ?? text } });
    active.settled = this.runInBackground(run, state, models, settings, controller.signal).finally(() => runs.release(runId));
    return { conversationId, runId };
  }

  private async runInBackground(
    run: AgentRun,
    state: ReturnType<typeof initialAgentState>,
    models: RoleLlms,
    settings: AgentSettings,
    signal: AbortSignal,
    startNode?: AgentNodeName,
  ): Promise<void> {
    const { deps } = this;
    const selectStepLlm =
      settings.routingStrategy === undefined
        ? undefined
        : (stepInput: {
            readonly node: 'route' | 'react';
            readonly intent: AgentState['intent'];
            readonly stepIndex: number;
            readonly toolCallCount: number;
            readonly hasFailures: boolean;
          }): RoutedStepLlm => {
            const available = new Set<LlmTier>(['high']);
            const needsTools = stepInput.node === 'react' && models.main.capabilities.tools;
            if (models.fast !== undefined && models.fastProfile !== null && (!needsTools || models.fast.capabilities.tools)) {
              available.add('medium');
            }
            if (models.fallback !== null && models.fallbackProfile !== null && (!needsTools || models.fallback.capabilities.tools)) {
              available.add('basic');
            }
            const chosen = selectTierForStep({
              strategy: settings.routingStrategy ?? 'hybrid_3_tiers',
              node: stepInput.node,
              intent: stepInput.intent,
              stepIndex: stepInput.stepIndex,
              toolCallCount: stepInput.toolCallCount,
              hasFailures: stepInput.hasFailures,
              availableTiers: available,
            });
            if (chosen.tier === 'medium' && models.fast !== undefined && models.fastProfile !== null) {
              return { llm: models.fast, role: 'fast', tier: 'medium', model: models.fastProfile.model };
            }
            if (chosen.tier === 'basic' && models.fallback !== null && models.fallbackProfile !== null) {
              return { llm: models.fallback, role: 'fallback', tier: 'basic', model: models.fallbackProfile.model };
            }
            return { llm: models.main, role: 'main', tier: 'high', model: models.mainProfile.model };
          };

    const ctx: NodeContext = {
      userId: run.userId, conversationId: run.conversationId, runId: run.id, store: deps.store,
      events: new GatedAgentEvents(deps.events, () => deps.runs.isMuted(run.id)), trace: deps.trace,
      log: deps.log, clock: deps.clock, ids: deps.ids, signal, budget: run.budget,
      profileIds: { main: run.profileIds.main, fast: run.profileIds.fast, fallbackUsed: run.profileIds.fallbackUsed }, mainModel: run.model, waited: { ms: 0 },
      routingStrategy: settings.routingStrategy,
      metricProfiles: {
        main: models.mainProfile,
        fast: models.fastProfile,
        fallback: models.fallbackProfile,
      },
      assistantMessageId: run.assistantMessageId, userMessageId: run.userMessageId,
      llm: (role) => pickRoleLlm(models, role),
      ...(selectStepLlm === undefined ? {} : { selectStepLlm }),
      fallbackLlm: () => models.fallback,
      fallbackModel: models.fallbackProfile?.model ?? null,
      providerName: providerNameOfProfile(models.mainProfile),
      emit: () => undefined,
      tools: deps.tools, contextStrategy: deps.contextStrategy, prompts: deps.prompts,
      ...(deps.memoryTools === undefined ? {} : { memoryTools: deps.memoryTools }),
      ...(deps.planTools === undefined ? {} : { planTools: deps.planTools }),
      ...(deps.folders === undefined ? {} : { folders: deps.folders }),
      ...(deps.capabilityIndex === undefined ? {} : { capabilityIndex: deps.capabilityIndex }),
      ...(deps.memory === undefined ? {} : { memory: deps.memory }),
      cloud: [models.mainProfile, models.fastProfile, models.fallbackProfile].some((profile) => profile !== null && requiresCloudConsent(profile.origin)),
    };
    try {
      const outcome = await runGraph(deps.graph, state, ctx, startNode);
      if (outcome.status === 'failed') {
        const code = outcome.error instanceof AgentError ? outcome.error.code : 'INTERNAL';
        // chave recusada/vencida e credito esgotado viram um aviso acionavel na conversa (spec 035, FR-011)
        const notice = noticeOfError(outcome.error, providerNameOfProfile(models.mainProfile));
        if (notice === null) {
          await deps.store.messages.update(run.userId, run.assistantMessageId, { status: 'error', errorCode: code });
        } else {
          const stored = (await deps.store.messages.list(run.userId, run.conversationId, { limit: 4 })).find((m) => m.id === run.assistantMessageId);
          const parts = [...(stored?.parts ?? []).filter((p) => !(p.type === 'notice' && p.kind === notice.kind)), notice];
          await deps.store.messages.update(run.userId, run.assistantMessageId, { status: 'error', errorCode: code, parts });
        }
      } else if (outcome.status === 'cancelled') {
        await deps.store.messages.update(run.userId, run.assistantMessageId, { status: 'interrupted' });
      }
      await deps.store.conversations.touch(run.userId, run.conversationId, deps.clock.now().toISOString());
      if (outcome.status === 'done') {
        deps.afterTurn?.schedule({ userId: run.userId, conversationId: run.conversationId, runId: run.id, userMessageId: run.userMessageId, assistantMessageId: run.assistantMessageId });
      }
    } catch (error) {
      deps.log.error('falha ao encerrar a execucao do agente', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}
