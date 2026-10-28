import { type ConversationSummary } from '../../../../domain/agent/summary/conversation.summary.ts';

/** Resumo corrente de cada conversa (spec 032): local ao aparelho; some com a conversa (cascata). */
export interface SummaryStorePort {
  getCurrent(userId: string, conversationId: string): Promise<ConversationSummary | null>;
  /** Atomico: substitui o resumo da conversa pelo novo (uma versao corrente por conversa). */
  replaceCurrent(summary: ConversationSummary): Promise<void>;
}
