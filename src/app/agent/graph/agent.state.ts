import { type Consumed } from '../../../domain/agent/consumed.ts';
import { type Fact } from '../../../domain/agent/fact.ts';
import { type Intent } from '../../../domain/agent/intent.ts';
import { type NoticePart } from '../../../domain/agent/notice.part.ts';
import { type QuerySummary } from '../../../domain/agent/query.summary.ts';
import { type LlmMessage } from '../ports/llm/llm.message.ts';
import { type LlmToolCall } from '../ports/llm/llm.tool.call.ts';

/** Contadores da execucao (limites de correcao e reparo). */
export interface AgentCounters {
  readonly llmCalls: number;
  readonly toolCalls: number;
  /** Quantas vezes o `respond` ja mandou o modelo corrigir valores (maximo 1). */
  readonly correctionAttempts: number;
  /** Quantas vezes argumentos invalidos de ferramenta ja voltaram ao modelo. */
  readonly argRepairAttempts: number;
}

/**
 * Estado serializavel de uma execucao (spec 031, contracts/agent.graph.md): JSON puro, sem
 * `Date` nem classes - e o que vai para o checkpoint. O historico anterior NAO esta aqui: e
 * reconstruido do armazenamento pela `ContextStrategy`.
 */
export interface AgentState {
  readonly runId: string;
  readonly intent: Intent | null;
  readonly pendingToolCalls: readonly LlmToolCall[];
  /** Mensagens da rodada em curso (assistente e resultados de ferramentas). */
  readonly turnMessages: readonly LlmMessage[];
  readonly ledger: readonly Fact[];
  readonly summaries: readonly QuerySummary[];
  /** Avisos a anexar a mensagem final (ex.: modelo sem ferramentas). */
  readonly notices: readonly NoticePart[];
  readonly finalText: string | null;
  /** Ids das preferencias que entraram no contexto desta resposta (spec 032: chip "aplicadas"). */
  readonly appliedPreferenceIds: readonly string[];
  /** Planos criados nesta execucao por `propose_changes` (spec 033); viram cartoes na mensagem final. */
  readonly planIds: readonly string[];
  /** Pedidos de capacidade criados nesta execucao por `find_capability` (spec 034); viram cartoes na mensagem final. */
  readonly capabilityRequestIds: readonly string[];
  /** Relatorios salvos nesta execucao por `write_report` (spec 040); viram cartoes "Abrir" na mensagem final. */
  readonly reports: readonly { readonly path: string; readonly format: 'md' | 'html' }[];
  readonly counters: AgentCounters;
  /** Consumo acumulado; mantido pelo runner, nao pelos nos. */
  readonly usage: Consumed;
}
