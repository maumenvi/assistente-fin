import { CONVERSATION_PAGE_SIZE, type ConversationListState } from './conversation.list.state.ts';
import { type ConversationItem } from './conversation.item.ts';

/** Acoes que mudam o painel de conversas. */
export type ConversationListAction =
  | { readonly kind: 'page_loaded'; readonly items: readonly ConversationItem[]; readonly append: boolean }
  | { readonly kind: 'upserted'; readonly item: ConversationItem }
  | { readonly kind: 'removed'; readonly id: string }
  | { readonly kind: 'cleared' };

export function emptyConversationList(): ConversationListState {
  return { items: [], hasMore: false, loaded: false };
}

function sorted(items: readonly ConversationItem[]): ConversationItem[] {
  return [...items].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt) || a.id.localeCompare(b.id));
}

function merge(current: readonly ConversationItem[], incoming: readonly ConversationItem[]): ConversationItem[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return sorted([...byId.values()]);
}

/** Reducer do painel de conversas: paginacao de 50, recencia por `lastMessageAt`, sem duplicar ids. */
export function reduceConversationList(state: ConversationListState, action: ConversationListAction): ConversationListState {
  switch (action.kind) {
    case 'page_loaded':
      return {
        items: action.append ? merge(state.items, action.items) : sorted(action.items),
        hasMore: action.items.length >= CONVERSATION_PAGE_SIZE,
        loaded: true,
      };
    case 'upserted':
      return { ...state, items: merge(state.items, [action.item]) };
    case 'removed':
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };
    case 'cleared':
      return { items: [], hasMore: false, loaded: true };
  }
}
