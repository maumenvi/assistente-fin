import { type AttachmentDraftStore } from '../attachment/draft/attachment.draft.store.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { type IdGenerator } from '../../shared/id.generator.port.ts';
import { type AfterTurnHooks } from '../after.turn.hooks.ts';
import { type ContextStrategy } from '../context/context.strategy.ts';
import { type Graph } from '../graph/graph.ts';
import { type AgentNodeName } from '../graph/agent.node.name.ts';
import { type AgentState } from '../graph/agent.state.ts';
import { type NodeContext } from '../graph/node.context.ts';
import { type MakeLlm } from '../llm/build.role.llms.ts';
import { type AgentEventsPort } from '../ports/events/agent.events.port.ts';
import { type AgentLogPort } from '../ports/observe/agent.log.port.ts';
import { type AgentTracePort } from '../ports/observe/agent.trace.port.ts';
import { type AgentSettingsPort } from '../ports/settings/agent.settings.port.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';
import { type ToolPort } from '../ports/tool/tool.port.ts';
import { type MemoryContext } from '../preference/memory.context.ts';
import { type AgentPrompts } from '../prompts/agent.prompts.ts';
import { type FolderBroker } from '../folders/folder.broker.ts';
import { type ActiveRuns } from '../runs/active.runs.ts';

/** Tudo de que `SendMessageUseCase` precisa, injetado pela composicao (`buildAgent`). */
export interface SendMessageDeps {
  readonly store: AgentStorePort;
  readonly settings: AgentSettingsPort;
  readonly makeLlm: MakeLlm;
  readonly consentTextVersion: string;
  readonly events: AgentEventsPort;
  readonly trace: AgentTracePort;
  readonly log: AgentLogPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly tools: ToolPort;
  readonly contextStrategy: ContextStrategy;
  readonly prompts: AgentPrompts;
  readonly graph: Graph<AgentNodeName, AgentState, NodeContext>;
  readonly runs: ActiveRuns;
  /** Tarefas depois da resposta (aprendizado e compactacao, spec 032); opcional. */
  readonly afterTurn?: AfterTurnHooks;
  /** Preferencias do usuario (spec 032); ausente = o agente nao usa nem grava preferencias. */
  readonly memory?: MemoryContext;
  /** Ferramentas de memoria, so expostas no intent `preference` (spec 032). */
  readonly memoryTools?: ToolPort;
  /** Ferramentas de planejamento, so expostas no intent `write_request` (spec 033); ausente = resposta fixa "so consulto". */
  readonly planTools?: ToolPort;
  /** Pastas autorizadas e pedidos de permissao (spec 040, so desktop); ausente = sem ferramentas de arquivo. */
  readonly folders?: FolderBroker;
  /** Rascunhos de anexo em memoria (spec 036); ausente = o envio recusa `attachmentIds`. */
  readonly drafts?: AttachmentDraftStore;
  /** Bloco do prompt com as capacidades conectadas (spec 034). */
  readonly capabilityIndex?: (userId: string) => Promise<string>;
}
