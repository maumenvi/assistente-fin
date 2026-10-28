import { type ConversationItem } from './conversation.item.ts';

/** Estado do painel de conversas (D9). */
export interface ConversationListState {
  /** Da mais recente para a mais antiga. */
  readonly items: readonly ConversationItem[];
  /** Ha mais paginas (a ultima veio cheia). */
  readonly hasMore: boolean;
  /** Primeira carga concluida. */
  readonly loaded: boolean;
}

/** Itens por pagina do painel. */
export const CONVERSATION_PAGE_SIZE = 50;
