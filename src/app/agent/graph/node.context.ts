import { type Intent } from '../../../domain/agent/intent.ts';
import { type ModelRole } from '../../../domain/agent/model.role.ts';
import { type LlmTier } from '../../../domain/agent/routing/llm.tier.ts';
import { type ContextStrategy } from '../context/context.strategy.ts';
import { type PickedLlm } from '../llm/picked.llm.ts';
import { type AgentEventBody } from '../ports/events/agent.event.body.ts';
import { type LlmPort } from '../ports/llm/llm.port.ts';
import { type FolderBroker } from '../folders/folder.broker.ts';
import { type MemoryContext } from '../preference/memory.context.ts';
import { type ToolPort } from '../ports/tool/tool.port.ts';
import { type AgentPrompts } from '../prompts/agent.prompts.ts';
import { type RunnerContext } from './runner.context.ts';

export interface RoutedStepLlm {
  readonly llm: LlmPort;
  readonly role: ModelRole;
  readonly tier: LlmTier;
  readonly model: string;
}

/**
 * Contexto entregue a cada no (spec 031, contracts/agent.graph.md): tudo injetado, nada global.
 * `llm('fast')` cai para o modelo principal quando nao ha modelo rapido configurado (FR-021) e
 * informa quem de fato responde (`answeredBy`). `emit` publica eventos de UI pelo mesmo contador
 * `seq` do runner. `fallbackLlm()` devolve o perfil alternativo, se houver.
 */
export interface NodeContext extends RunnerContext {
  /** Mensagem do assistente que recebe o texto desta execucao. */
  readonly assistantMessageId: string;
  /** Mensagem do usuario que originou esta execucao (fica fora do historico enviado ao modelo). */
  readonly userMessageId: string;
  llm(role: 'main' | 'fast'): PickedLlm;
  /** Roteamento inteligente em 3 niveis (spec 038, FR-016) quando estrategia ativa. */
  selectStepLlm?(input: {
    readonly node: 'route' | 'react';
    readonly intent: Intent | null;
    readonly stepIndex: number;
    readonly toolCallCount: number;
    readonly hasFailures: boolean;
  }): RoutedStepLlm;
  fallbackLlm(): LlmPort | null;
  /** Modelo do perfil alternativo (para o aviso "usei o modelo alternativo"); ausente = desconhecido. */
  readonly fallbackModel?: string | null;
  /** Nome do provedor do modelo principal, para os avisos de chave/credito (spec 035). */
  readonly providerName?: string;
  emit(body: AgentEventBody): void;
  readonly tools: ToolPort;
  /** Ferramentas de memoria (spec 032), so usadas no intent `preference`. */
  readonly memoryTools?: ToolPort;
  /** Ferramentas de planejamento (spec 033): consulta + `propose_changes`, so no intent `write_request`. */
  readonly planTools?: ToolPort;
  /** Pastas autorizadas e pedidos de permissao no chat (spec 040); ausente = sem acesso a arquivos. */
  readonly folders?: FolderBroker;
  /** Bloco do prompt com as capacidades conectadas (spec 034); ausente = sem capacidades. */
  readonly capabilityIndex?: (userId: string) => Promise<string>;
  /** Preferencias do usuario e de onde tirar contas/categorias (spec 032); ausente = sem preferencias. */
  readonly memory?: MemoryContext;
  /** Algum modelo desta execucao (principal, rapido ou alternativo) e de nuvem: privadas ficam de fora. */
  readonly cloud: boolean;
  readonly contextStrategy: ContextStrategy;
  readonly prompts: AgentPrompts;
}
