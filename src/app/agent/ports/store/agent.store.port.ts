import { type AttachmentStorePort } from '../../attachment/ports/attachment.store.port.ts';
import { type AgentMetricStorePort } from './agent.metric.store.port.ts';
import { type ConversationStorePort } from './conversation.store.port.ts';
import { type MessageStorePort } from './message.store.port.ts';
import { type RunStorePort } from './run.store.port.ts';
import { type StepStorePort } from './step.store.port.ts';
import { type SummaryStorePort } from './summary.store.port.ts';

/**
 * Armazenamento do agente (spec 031, contracts/agent.store.port.md), exposto na porta `Database`
 * como `Database.agent`. Tres implementacoes: `fake`, `sqlite` (celular) e `prisma` (desktop).
 */
export interface AgentStorePort {
  readonly conversations: ConversationStorePort;
  readonly messages: MessageStorePort;
  readonly runs: RunStorePort;
  readonly steps: StepStorePort;
  /** Resumo corrente por conversa (spec 032). */
  readonly summaries: SummaryStorePort;
  /** Anexos das mensagens (spec 036): locais ao aparelho, fora do backup e do sync. */
  readonly attachments: AttachmentStorePort;
  /** Metricas permanentes de uso das LLMs (spec 038): preservadas mesmo se conversas forem apagadas. */
  readonly metrics: AgentMetricStorePort;
}
