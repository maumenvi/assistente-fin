import { FolderBroker } from '../app/agent/folders/folder.broker.ts';
import { SecretFolderGrantStore } from '../app/agent/folders/secret.folder.grant.store.ts';
import { AddFolderGrantUseCase } from '../app/agent/folders/add.folder.grant.use.case.ts';
import { ListFolderGrantsUseCase } from '../app/agent/folders/list.folder.grants.use.case.ts';
import { RevokeFolderGrantUseCase } from '../app/agent/folders/revoke.folder.grant.use.case.ts';
import { DecideFolderPermissionUseCase } from '../app/agent/folders/decide.folder.permission.use.case.ts';
import { DecideFileEditUseCase } from '../app/agent/folders/decide.file.edit.use.case.ts';
import { type FileAccessPort } from '../app/agent/ports/files/file.access.port.ts';
import { type GitProbePort } from '../app/agent/ports/files/git.probe.port.ts';
import { type DenyContext } from '../domain/agent/folder/is.denied.path.ts';
import { CompositeToolPort } from '../app/agent/tools/composite.tool.port.ts';
import { buildFileTools, createFileToolRegistry } from '../app/agent/tools/files/file.tool.registry.ts';
import { MemoryAgentEvents } from '../app/agent/events/memory.agent.events.ts';
import { agentGraph } from '../app/agent/graph/agent.graph.ts';
import { describeGraph } from '../app/agent/graph/describe.graph.ts';
import { type GraphDescription } from '../app/agent/graph/graph.description.ts';
import { NODE_LABELS } from '../app/agent/graph/node.labels.ts';
import { buildLlmPort } from '../app/agent/llm/build.llm.port.ts';
import { type MakeLlm } from '../app/agent/llm/build.role.llms.ts';
import { LogSinkAgentLog } from '../app/agent/log/log.sink.agent.log.ts';
import { type AgentEventsPort } from '../app/agent/ports/events/agent.events.port.ts';
import { type AgentTracePort } from '../app/agent/ports/observe/agent.trace.port.ts';
import { type AgentSettingsPort } from '../app/agent/ports/settings/agent.settings.port.ts';
import { type SecretStorePort } from '../app/agent/ports/settings/secret.store.port.ts';
import { type ToolPort } from '../app/agent/ports/tool/tool.port.ts';
import { type AgentPrompts } from '../app/agent/prompts/agent.prompts.ts';
import { DEFAULT_AGENT_PROMPTS } from '../app/agent/prompts/default.agent.prompts.ts';
import { ActiveRuns } from '../app/agent/runs/active.runs.ts';
import { CLOUD_CONSENT_VERSION } from '../app/agent/settings/cloud.consent.version.ts';
import { buildDefaultAgentTools } from '../app/agent/tools/default.agent.tools.ts';
import { RegistryToolPort } from '../app/agent/tools/registry.tool.port.ts';
import { type AgentToolDeps } from '../app/agent/tools/shared/agent.tool.deps.ts';
import { createToolRegistry } from '../app/agent/tools/tool.registry.ts';
import { CompositeTrace } from '../app/agent/trace/composite.trace.ts';
import { LogSinkTrace } from '../app/agent/trace/log.sink.trace.ts';
import { StoreTrace } from '../app/agent/trace/store.trace.ts';
import { ConfigureModelsUseCase } from '../app/agent/use-cases/configure.models.use.case.ts';
import { GetConsentStatusUseCase } from '../app/agent/use-cases/get.consent.status.use.case.ts';
import { ListAvailableModelsUseCase } from '../app/agent/use-cases/list.available.models.use.case.ts';
import { DeleteAllRunsUseCase } from '../app/agent/use-cases/delete.all.runs.use.case.ts';
import { GetRunDetailUseCase } from '../app/agent/use-cases/get.run.detail.use.case.ts';
import { ListRunsUseCase } from '../app/agent/use-cases/list.runs.use.case.ts';
import { CancelRunsOnSessionEndUseCase } from '../app/agent/use-cases/cancel.runs.on.session.end.use.case.ts';
import { RetryLastUseCase } from '../app/agent/use-cases/retry.last.use.case.ts';
import { RetryWithFallbackUseCase } from '../app/agent/use-cases/retry.with.fallback.use.case.ts';
import { ContinueRunUseCase } from '../app/agent/use-cases/continue.run.use.case.ts';
import { GetAgentMetricsReportUseCase } from '../app/agent/use-cases/get.agent.metrics.report.use.case.ts';
import { StopRunUseCase } from '../app/agent/use-cases/stop.run.use.case.ts';
import { RecoverRunsUseCase } from '../app/agent/use-cases/recover.runs.use.case.ts';
import { RecordConsentUseCase } from '../app/agent/use-cases/record.consent.use.case.ts';
import { RevokeConsentUseCase } from '../app/agent/use-cases/revoke.consent.use.case.ts';
import { readAttachmentTool } from '../app/agent/attachment/tools/read.attachment.tool.ts';
import { AttachmentDraftStore } from '../app/agent/attachment/draft/attachment.draft.store.ts';
import { DiscardDraftUseCase } from '../app/agent/attachment/draft/discard.draft.use.case.ts';
import { DeleteAllAttachmentsUseCase, DeleteAttachmentUseCase, DeleteConversationAttachmentsUseCase } from '../app/agent/attachment/manage/delete.attachment.use.case.ts';
import { GetAttachmentUseCase } from '../app/agent/attachment/manage/get.attachment.use.case.ts';
import { CheckAttachmentsUseCase } from '../app/agent/attachment/gate/check.attachments.use.case.ts';
import { PrepareAttachmentUseCase } from '../app/agent/attachment/draft/prepare.attachment.use.case.ts';
import { type ImageReducerPort } from '../app/agent/attachment/ports/image.reducer.port.ts';
import { type PdfTextPort } from '../app/agent/attachment/ports/pdf.text.port.ts';
import { UnavailablePdfText } from '../app/agent/attachment/ports/unavailable.pdf.text.ts';
import { ClearSetupKeyUseCase } from '../app/agent/setup/clear.setup.key.use.case.ts';
import { GetSetupViewUseCase } from '../app/agent/setup/get.setup.view.use.case.ts';
import { SaveSetupUseCase } from '../app/agent/setup/save.setup.use.case.ts';
import { type SetupDeps } from '../app/agent/setup/setup.deps.ts';
import { TestSetupUseCase } from '../app/agent/setup/test.setup.use.case.ts';
import { TestConnectionUseCase } from '../app/agent/use-cases/test.connection.use.case.ts';
import { DeleteAllConversationsUseCase } from '../app/agent/use-cases/delete.all.conversations.use.case.ts';
import { DeleteConversationUseCase } from '../app/agent/use-cases/delete.conversation.use.case.ts';
import { GetConversationMessagesUseCase } from '../app/agent/use-cases/get.conversation.messages.use.case.ts';
import { ListConversationsUseCase } from '../app/agent/use-cases/list.conversations.use.case.ts';
import { NewConversationUseCase } from '../app/agent/use-cases/new.conversation.use.case.ts';
import { AfterTurnHooks } from '../app/agent/after.turn.hooks.ts';
import { buildRoleLlms } from '../app/agent/llm/build.role.llms.ts';
import { pickRoleLlm } from '../app/agent/llm/pick.role.llm.ts';
import { CompactionTask } from '../app/agent/compaction/compaction.task.ts';
import { CompactingContextStrategy } from '../app/agent/context/compacting.context.strategy.ts';
import { LearningTask } from '../app/agent/preference/learn/learning.task.ts';
import { ConfirmPreferenceUseCase } from '../app/agent/preference/use-cases/confirm.preference.use.case.ts';
import { GetConversationSummaryUseCase } from '../app/agent/use-cases/get.conversation.summary.use.case.ts';
import { GetPreferencesScreenUseCase } from '../app/agent/preference/use-cases/get.preferences.screen.use.case.ts';
import { MarkNoticesSeenUseCase } from '../app/agent/preference/use-cases/mark.notices.seen.use.case.ts';
import { DismissPreferenceUseCase } from '../app/agent/preference/use-cases/dismiss.preference.use.case.ts';
import { buildMemoryTools } from '../app/agent/preference/build.memory.tools.ts';
import { type MemoryContext } from '../app/agent/preference/memory.context.ts';
import { DeleteAllPreferencesUseCase } from '../app/agent/preference/use-cases/delete.all.preferences.use.case.ts';
import { DeletePreferenceUseCase } from '../app/agent/preference/use-cases/delete.preference.use.case.ts';
import { ListPreferencesUseCase } from '../app/agent/preference/use-cases/list.preferences.use.case.ts';
import { RestorePreferenceOverwriteUseCase } from '../app/agent/preference/use-cases/restore.preference.overwrite.use.case.ts';
import { SetPreferencePrivateUseCase } from '../app/agent/preference/use-cases/set.preference.private.use.case.ts';
import { UpdatePreferenceUseCase } from '../app/agent/preference/use-cases/update.preference.use.case.ts';
import { type PreferenceStoresPort } from '../app/agent/ports/preference/preference.stores.port.ts';
import { FakePreferenceStores } from '../database/fake/preference.stores.fake.ts';
import { ExpirePlansTask } from '../app/agent/plan/engine/expire.plans.task.ts';
import { proposeChangesTool } from '../app/agent/plan/tools/propose.changes.tool.ts';
import { eraseAgentTool } from '../app/agent/tools/agent.tool.ts';
import { PlanService } from '../app/agent/plan/engine/plan.service.ts';
import { type Database } from '../app/shared/database.port.ts';
import { type AgentWritersFactory } from './build.agent.writers.ts';
import { CapabilityService } from '../app/agent/capability/capability.service.ts';
import { ExpireRequestsTask } from '../app/agent/capability/engine/expire.requests.task.ts';
import { type CapabilityStoresPort } from '../app/agent/capability/ports/capability.stores.port.ts';
import { type CatalogPlatform, type CatalogPort } from '../app/agent/capability/ports/catalog.port.ts';
import { CredentialVault } from '../app/agent/capability/ports/credential.vault.ts';
import { type McpClientPort } from '../app/agent/capability/ports/mcp.client.port.ts';
import { type SkillSourcePort } from '../app/agent/capability/ports/skill.source.port.ts';
import { sha256Hex } from '../libs/crypto/sha256.ts';
import { SendMessageUseCase } from '../app/agent/use-cases/send.message.use.case.ts';
import { type AgentStorePort } from '../app/agent/ports/store/agent.store.port.ts';
import { type Clock } from '../app/shared/clock.port.ts';
import { type IdGenerator } from '../app/shared/id.generator.port.ts';
import { type LogSink } from '../app/shared/log.sink.port.ts';
import { type LogEvent } from '../domain/logging/log.event.ts';
import { type FetchFn } from '../libs/llm/fetch.fn.ts';
import { type OpenAiCompatOptions } from '../libs/llm/openai-compat/openai.compat.options.ts';

/** O que o agente precisa da raiz de composicao (spec 031, T079). Cada borda (desktop, Android) fornece o seu. */
export interface AgentDeps {
  /** Armazenamento do agente (`Database.agent`). */
  readonly store: AgentStorePort;
  /** Casos de uso de consulta que as ferramentas usam (o `Container` do app satisfaz). */
  readonly toolDeps: AgentToolDeps;
  readonly settings: AgentSettingsPort;
  readonly secrets: SecretStorePort;
  /** `fetch` da plataforma (global no desktop, `expo/fetch` no Android). */
  readonly fetchFn: FetchFn;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Destino do resumo do trace e do log interno (spec 017); `null` = so armazenamento. */
  readonly logSink: LogSink | null;
  /** Origem dos eventos de log: `ipc` no desktop, `mobile` no Android. */
  readonly logSource: LogEvent['source'];
  /** Troca a montagem de modelos (testes e avaliacoes). Padrao: `createLlmPort`. */
  readonly makeLlm?: MakeLlm;
  /** Ajustes do adaptador de LLM (tempos, retentativas), usados em testes. */
  readonly adapter?: Partial<OpenAiCompatOptions>;
  /** Troca os textos do agente (a avaliacao de regressao injeta um prompt degradado). Padrao: os oficiais. */
  readonly prompts?: AgentPrompts;
  /** Aceita perfis de servidor local (so o desktop); padrao `false`. */
  readonly allowLocal?: boolean;
  /** Anexos (spec 036): leitor de PDF e redutor de imagem da plataforma. Sem leitor de PDF, PDF e recusado; sem redutor, imagem tambem. */
  readonly attachmentPorts?: { readonly pdf?: PdfTextPort | undefined; readonly images?: ImageReducerPort | undefined };
  /**
   * Acesso a pastas e arquivos do computador (spec 040, so desktop): disco, git e a lista de caminhos proibidos. Sem isto o agente
   * nao recebe as ferramentas de arquivo (o app Android nao passa).
   */
  readonly files?: { readonly access: FileAccessPort; readonly git: GitProbePort; readonly deny: DenyContext };
  /** Enderecos de teste por provedor (so e2e, spec 035); vazio em producao. */
  readonly providerUrls?: SetupDeps['urlOverrides'];
  /** Preferencias do usuario (`Database.preferences`, spec 032). Sem isto ficam so em memoria (testes). */
  readonly preferences?: PreferenceStoresPort;
  /**
   * Banco e escritores da aplicacao de planos (spec 033): o `Database` real e a fabrica de casos de uso
   * ligados a uma transacao (`Container.agentWriters`). Sem isto o agente so propoe: aplicar falha com
   * erro claro (testes que nao escrevem).
   */
  readonly plans?: { readonly db: Database; readonly writers: AgentWritersFactory };
  /**
   * Capacidades dinamicas (spec 034): armazenamento local, catalogo, cliente MCP e (opcional) fonte de skills.
   * Sem isto o agente nao recebe as meta-ferramentas nem o indice de capacidades.
   */
  readonly capabilities?: {
    readonly stores: CapabilityStoresPort;
    readonly catalog: CatalogPort;
    readonly mcp: McpClientPort;
    readonly skills?: SkillSourcePort | undefined;
    readonly platform: CatalogPlatform;
    /** Servidor local de desenvolvimento liberado neste aparelho? Padrao: nao. */
    readonly allowInsecureLocal?: (() => boolean) | undefined;
  };
}

/** Tempo maximo de uma ferramenta de arquivo: inclui a espera pela decisao da pessoa no chat (parar a execucao cancela antes). */
const FILE_TOOL_TIMEOUT_MS = 30 * 60_000;

/** O agente pronto para as bordas. */
export interface Agent {
  readonly sendMessage: SendMessageUseCase;
  readonly listConversations: ListConversationsUseCase;
  readonly getConversationMessages: GetConversationMessagesUseCase;
  readonly newConversation: NewConversationUseCase;
  readonly deleteConversation: DeleteConversationUseCase;
  readonly deleteAllConversations: DeleteAllConversationsUseCase;
  readonly configureModels: ConfigureModelsUseCase;
  readonly testConnection: TestConnectionUseCase;
  /** Anexos do chat (spec 036): prepara e descarta rascunhos em memoria; o envio os consome. */
  readonly attachments: {
    readonly drafts: AttachmentDraftStore;
    readonly prepare: PrepareAttachmentUseCase;
    readonly discard: DiscardDraftUseCase;
    /** Pre-checagem de privacidade/visao/janela antes do envio (spec 036). */
    readonly check: CheckAttachmentsUseCase;
    /** Abre um anexo ja enviado (so o dono). */
    readonly get: GetAttachmentUseCase;
    readonly delete: DeleteAttachmentUseCase;
    readonly deleteConversation: DeleteConversationAttachmentsUseCase;
    readonly deleteAll: DeleteAllAttachmentsUseCase;
    /** Totais de anexos guardados (contagem e bytes) para o cartao Privacidade › Anexos. */
    readonly stats: (userId: string) => Promise<{ count: number; totalBytes: number }>;
  };
  /** Configuracao simplificada (spec 035): estado da tela, teste em etapas, salvar e apagar chave. */
  readonly setup: {
    readonly get: GetSetupViewUseCase;
    readonly test: TestSetupUseCase;
    readonly save: SaveSetupUseCase;
    readonly clearKey: ClearSetupKeyUseCase;
  };
  readonly listAvailableModels: ListAvailableModelsUseCase;
  readonly recordConsent: RecordConsentUseCase;
  readonly revokeConsent: RevokeConsentUseCase;
  readonly getConsentStatus: GetConsentStatusUseCase;
  readonly recoverRuns: RecoverRunsUseCase;
  readonly stopRun: StopRunUseCase;
  readonly listRuns: ListRunsUseCase;
  readonly getRunDetail: GetRunDetailUseCase;
  readonly deleteAllRuns: DeleteAllRunsUseCase;
  readonly cancelRunsOnSessionEnd: CancelRunsOnSessionEndUseCase;
  readonly retryLast: RetryLastUseCase;
  readonly retryWithFallback: RetryWithFallbackUseCase;
  readonly continueRun: ContinueRunUseCase;
  readonly getMetricsReport: GetAgentMetricsReportUseCase;
  readonly events: AgentEventsPort;
  readonly runs: ActiveRuns;
  /** Tarefas depois da resposta (aprendizado e compactacao, spec 032); `settled()` serve aos testes. */
  readonly afterTurn: AfterTurnHooks;
  /** Armazenamento de preferencias, sinais, recusas e avisos (spec 032). */
  readonly preferenceStores: PreferenceStoresPort;
  readonly listPreferences: ListPreferencesUseCase;
  readonly updatePreference: UpdatePreferenceUseCase;
  readonly setPreferencePrivate: SetPreferencePrivateUseCase;
  readonly deletePreference: DeletePreferenceUseCase;
  readonly deleteAllPreferences: DeleteAllPreferencesUseCase;
  readonly restorePreferenceOverwrite: RestorePreferenceOverwriteUseCase;
  readonly confirmPreference: ConfirmPreferenceUseCase;
  readonly dismissPreference: DismissPreferenceUseCase;
  readonly getPreferencesScreen: GetPreferencesScreenUseCase;
  readonly getConversationSummary: GetConversationSummaryUseCase;
  readonly markNoticesSeen: MarkNoticesSeenUseCase;
  /** Planos de alteracao: propor, aprovar, recusar, ajustar, desfazer e historico (spec 033). */
  readonly plans: PlanService;
  /** Capacidades dinamicas: pedidos, aprovacao, pausa, revogacao e historico (spec 034). */
  readonly capabilities: CapabilityService;
  readonly trace: AgentTracePort;
  readonly tools: ToolPort;
  /** Pastas autorizadas e pedidos de permissao do chat (spec 040); `null` onde nao ha acesso a arquivos. */
  readonly folders: {
    readonly broker: FolderBroker;
    readonly list: ListFolderGrantsUseCase;
    readonly add: AddFolderGrantUseCase;
    readonly decide: DecideFolderPermissionUseCase;
    readonly decideEdit: DecideFileEditUseCase;
    readonly revoke: RevokeFolderGrantUseCase;
  } | null;
  /** O grafo como dado (nos e arestas), para o diagrama e a tela de execucao. */
  describeGraph(): GraphDescription;
}

/**
 * Monta o agente: ferramentas de consulta, trace (armazenamento + resumo no log), eventos, grafo e
 * casos de uso. Nada global: tudo vem de `deps`.
 */
export function buildAgent(deps: AgentDeps): Agent {
  const drafts = new AttachmentDraftStore(deps.clock);
  const log = new LogSinkAgentLog(deps.logSink, { source: deps.logSource, ids: deps.ids });
  const setupDeps: SetupDeps = { settings: deps.settings, secrets: deps.secrets, fetchFn: deps.fetchFn, clock: deps.clock, platform: deps.allowLocal === true ? 'desktop' : 'android', urlOverrides: deps.providerUrls };
  const trace = new CompositeTrace([
    new StoreTrace(deps.store, log),
    new LogSinkTrace(deps.logSink, { source: deps.logSource, ids: deps.ids }),
  ]);
  const events = new MemoryAgentEvents();
  const runs = new ActiveRuns();
  const afterTurn = new AfterTurnHooks(log);
  const preferenceStores = deps.preferences ?? new FakePreferenceStores();
  const memory: MemoryContext = {
    stores: preferenceStores,
    entities: async (userId) => {
      const [accounts, categories] = await Promise.all([deps.toolDeps.listAccounts.execute({ userId }), deps.toolDeps.listCategories.execute({ userId })]);
      return {
        accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
        categories: categories
          .filter((c) => !c.isSystemBalance && !c.isSystemOpeningBalance && !c.isSystemAdjustment && !c.isSystemTransfer && !c.isSystemCardPayment)
          .map((c) => ({ id: c.id, name: c.name.value })),
      };
    },
    lastAppliedIds: async (userId, conversationId) => {
      const messages = await deps.store.messages.list(userId, conversationId, { limit: 20 });
      const last = messages.findLast((m) => m.role === 'assistant' && m.parts.some((p) => p.type === 'preferences_applied'));
      const part = last?.parts.find((p) => p.type === 'preferences_applied');
      return part?.type === 'preferences_applied' ? part.ids : [];
    },
  };
  const memoryTools = new RegistryToolPort(createToolRegistry(buildMemoryTools({ ...memory, ids: deps.ids, clock: deps.clock }), ['memory']));
  const preferenceUseCaseDeps = { stores: preferenceStores, clock: deps.clock, entities: memory.entities };
  const makeLlm: MakeLlm =
    deps.makeLlm ??
    ((profile) => buildLlmPort(profile, { secrets: deps.secrets, fetchFn: deps.fetchFn, ...(deps.adapter === undefined ? {} : { adapter: deps.adapter }) }));
  // modelos que a politica de consentimento e de modo local ja permite (spec 032): o rapido, senao o
  // principal, para tarefas curtas em segundo plano; `null` = nenhum permitido agora
  const permittedModels = async (userId: string) => {
    try {
      const models = await buildRoleLlms(await deps.settings.read(userId), await deps.settings.readConsent(userId), CLOUD_CONSENT_VERSION, makeLlm);
      const picked = pickRoleLlm(models, 'fast');
      const profile = picked.answeredBy === 'fast' ? models.fastProfile : models.mainProfile;
      return {
        fast: picked.llm,
        fastProfileId: (profile ?? models.mainProfile).id,
        contextWindow: models.main.capabilities.contextWindow,
        modelKey: `${models.mainProfile.id}|${models.mainProfile.model}`,
      };
    } catch {
      return null;
    }
  };
  // aprendizado organico (spec 032): depois da resposta, fora do caminho dela; o refino do texto
  // so usa um modelo permitido
  afterTurn.register(
    new LearningTask({
      memory, store: deps.store, events, clock: deps.clock, ids: deps.ids, log,
      refineModel: async (userId) => (await permittedModels(userId))?.fast ?? null,
    }),
  );
  // compactacao da conversa (spec 032): depois do aprendizado, tambem fora do caminho da resposta
  afterTurn.register(
    new CompactionTask({
      store: deps.store, memory, events, clock: deps.clock, ids: deps.ids, log,
      systemPrompt: () => (deps.prompts ?? DEFAULT_AGENT_PROMPTS).compactionSystem(),
      model: async (userId) => {
        const permitted = await permittedModels(userId);
        return permitted === null ? null : { llm: permitted.fast, profileId: permitted.fastProfileId, contextWindow: permitted.contextWindow, modelKey: permitted.modelKey };
      },
    }),
  );
  const plans = new PlanService(
    deps.plans === undefined ? null : { db: deps.plans.db, writers: deps.plans.writers, ids: deps.ids, clock: deps.clock, toolDeps: deps.toolDeps },
  );
  afterTurn.register(new ExpirePlansTask(plans));
  const capabilities = new CapabilityService(
    deps.capabilities === undefined
      ? null
      : {
          stores: deps.capabilities.stores, catalog: deps.capabilities.catalog, mcp: deps.capabilities.mcp, vault: new CredentialVault(deps.secrets), ...(deps.capabilities.skills === undefined ? {} : { skills: deps.capabilities.skills }),
          platform: deps.capabilities.platform, ids: deps.ids, clock: deps.clock, sha256: sha256Hex, allowInsecureLocal: deps.capabilities.allowInsecureLocal ?? (() => false),
        },
    async (userId, conversationId) => {
      const recent = await deps.store.messages.list(userId, conversationId, { limit: 12 });
      return recent.filter((m) => m.role === 'user').map((m) => m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('')).join('\n');
    },
  );
  if (capabilities.wired) afterTurn.register(new ExpireRequestsTask(capabilities));
  const capabilityTools = capabilities.tools();
  const readAttachment = eraseAgentTool(readAttachmentTool(deps.store.attachments));
  const queryTools = new RegistryToolPort(createToolRegistry([...buildDefaultAgentTools(deps.toolDeps), readAttachment, ...capabilityTools], capabilityTools.length > 0 ? ['read', 'external'] : ['read']));
  const planQueryTools = new RegistryToolPort(createToolRegistry([...buildDefaultAgentTools(deps.toolDeps), eraseAgentTool(proposeChangesTool(plans, deps.store.attachments)), readAttachment, ...capabilityTools], capabilityTools.length > 0 ? ['read', 'write', 'external'] : ['read', 'write']));
  // pastas e arquivos do computador (spec 040): registro PROPRIO e so desktop; a permissao e pedida no chat
  const folderBroker =
    deps.files === undefined
      ? null
      : new FolderBroker({ store: new SecretFolderGrantStore(deps.secrets), files: deps.files.access, ids: deps.ids, clock: deps.clock, deny: deps.files.deny });
  const fileTools =
    deps.files === undefined
      ? null
      : new RegistryToolPort(createFileToolRegistry(buildFileTools({ files: deps.files.access, git: deps.files.git, pdf: deps.attachmentPorts?.pdf })), { timeoutMs: FILE_TOOL_TIMEOUT_MS });
  const tools = fileTools === null ? queryTools : new CompositeToolPort([queryTools, fileTools]);
  const planTools = fileTools === null ? planQueryTools : new CompositeToolPort([planQueryTools, fileTools]);
  // as permissoes "so desta vez" e os pedidos sem resposta acabam junto com a execucao
  if (folderBroker !== null) events.subscribe((event) => { if (event.type === 'run_finished') folderBroker.releaseRun(event.runId); });
  const sendMessage = new SendMessageUseCase({
    store: deps.store, settings: deps.settings, makeLlm, consentTextVersion: CLOUD_CONSENT_VERSION, events, trace, log, clock: deps.clock, drafts,
    ids: deps.ids, tools, contextStrategy: new CompactingContextStrategy(), prompts: deps.prompts ?? DEFAULT_AGENT_PROMPTS, graph: agentGraph, runs, afterTurn, memory, memoryTools, planTools,
    ...(folderBroker === null ? {} : { folders: folderBroker }),
    ...(capabilities.wired ? { capabilityIndex: (userId: string) => capabilities.index(userId) } : {}),
  });
  return {
    sendMessage,
    stopRun: new StopRunUseCase(deps.store, runs),
    listRuns: new ListRunsUseCase(deps.store),
    getRunDetail: new GetRunDetailUseCase(deps.store, (userId, runId) => plans.listByRun(userId, runId)),
    deleteAllRuns: new DeleteAllRunsUseCase(deps.store),
    cancelRunsOnSessionEnd: new CancelRunsOnSessionEndUseCase(runs, afterTurn),
    retryLast: new RetryLastUseCase(sendMessage),
    retryWithFallback: new RetryWithFallbackUseCase(sendMessage),
    continueRun: new ContinueRunUseCase(sendMessage),
    getMetricsReport: new GetAgentMetricsReportUseCase({ store: deps.store }),
    listConversations: new ListConversationsUseCase(deps.store),
    getConversationMessages: new GetConversationMessagesUseCase(deps.store),
    newConversation: new NewConversationUseCase(deps.store, deps.ids, deps.clock),
    deleteConversation: new DeleteConversationUseCase(deps.store, runs, preferenceStores.preferences),
    deleteAllConversations: new DeleteAllConversationsUseCase(deps.store, runs, preferenceStores.preferences),
    configureModels: new ConfigureModelsUseCase({ settings: deps.settings, secrets: deps.secrets, allowLocal: deps.allowLocal ?? false }),
    testConnection: new TestConnectionUseCase({ settings: deps.settings, secrets: deps.secrets, fetchFn: deps.fetchFn, clock: deps.clock }),
    attachments: {
      drafts,
      prepare: new PrepareAttachmentUseCase({ drafts, pdf: deps.attachmentPorts?.pdf ?? new UnavailablePdfText(), images: deps.attachmentPorts?.images, ids: deps.ids, clock: deps.clock }),
      discard: new DiscardDraftUseCase(drafts),
      check: new CheckAttachmentsUseCase({ settings: deps.settings, drafts, makeLlm }),
      get: new GetAttachmentUseCase(deps.store.attachments),
      delete: new DeleteAttachmentUseCase(deps.store),
      deleteConversation: new DeleteConversationAttachmentsUseCase(deps.store),
      deleteAll: new DeleteAllAttachmentsUseCase(deps.store),
      stats: (userId) => deps.store.attachments.stats(userId),
    },
    setup: {
      get: new GetSetupViewUseCase(setupDeps),
      test: new TestSetupUseCase(setupDeps),
      save: new SaveSetupUseCase(setupDeps),
      clearKey: new ClearSetupKeyUseCase(setupDeps),
    },
    listAvailableModels: new ListAvailableModelsUseCase({ settings: deps.settings, secrets: deps.secrets, fetchFn: deps.fetchFn, clock: deps.clock }),
    recordConsent: new RecordConsentUseCase({ settings: deps.settings, clock: deps.clock }),
    revokeConsent: new RevokeConsentUseCase({ settings: deps.settings, clock: deps.clock }),
    getConsentStatus: new GetConsentStatusUseCase({ settings: deps.settings, clock: deps.clock }),
    recoverRuns: new RecoverRunsUseCase(deps.store, deps.settings, deps.clock),
    events,
    runs,
    afterTurn,
    preferenceStores,
    listPreferences: new ListPreferencesUseCase(preferenceStores),
    updatePreference: new UpdatePreferenceUseCase(preferenceUseCaseDeps),
    setPreferencePrivate: new SetPreferencePrivateUseCase(preferenceUseCaseDeps),
    deletePreference: new DeletePreferenceUseCase(preferenceUseCaseDeps),
    deleteAllPreferences: new DeleteAllPreferencesUseCase(preferenceUseCaseDeps),
    restorePreferenceOverwrite: new RestorePreferenceOverwriteUseCase(preferenceStores, deps.clock),
    confirmPreference: new ConfirmPreferenceUseCase({ stores: preferenceStores, store: deps.store, clock: deps.clock }),
    dismissPreference: new DismissPreferenceUseCase({ stores: preferenceStores, store: deps.store, clock: deps.clock }),
    getPreferencesScreen: new GetPreferencesScreenUseCase(preferenceUseCaseDeps),
    getConversationSummary: new GetConversationSummaryUseCase(deps.store),
    markNoticesSeen: new MarkNoticesSeenUseCase(preferenceUseCaseDeps),
    plans,
    capabilities,
    trace,
    tools,
    folders:
      folderBroker === null
        ? null
        : {
            broker: folderBroker,
            list: new ListFolderGrantsUseCase(folderBroker),
            add: new AddFolderGrantUseCase(folderBroker),
            decide: new DecideFolderPermissionUseCase(folderBroker),
            decideEdit: new DecideFileEditUseCase(folderBroker),
            revoke: new RevokeFolderGrantUseCase(folderBroker),
          },
    describeGraph: () => describeGraph(agentGraph, NODE_LABELS),
  };
}
