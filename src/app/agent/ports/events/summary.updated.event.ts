import { type AgentEventBase } from './agent.event.base.ts';

/**
 * A conversa foi compactada (spec 032, FR-019a): o item "Contexto resumido" passa a ficar apos a
 * mensagem `messageId`. Chega DEPOIS da execucao, com `runId` proprio (`<run>:compact`).
 */
export interface SummaryUpdatedEvent extends AgentEventBase {
  readonly type: 'summary_updated';
  readonly messageId: string;
  readonly summaryId: string;
  readonly coveredFromSeq: number;
  readonly coveredToSeq: number;
}
