import { type SummaryContent } from './summary.content.ts';

/**
 * Resumo corrente de uma conversa (spec 032): cobre as mensagens `coveredFromSeq`..`coveredToSeq`
 * e existe uma versao por conversa. Fica so no aparelho (a conversa nao sincroniza).
 */
export interface ConversationSummary {
  readonly id: string;
  readonly userId: string;
  readonly conversationId: string;
  readonly coveredFromSeq: number;
  readonly coveredToSeq: number;
  readonly content: SummaryContent;
  readonly modelProfileId: string;
  readonly tokensEstimate: number;
  /** Incrementa a cada compactacao. */
  readonly generation: number;
  readonly createdAt: string;
}
