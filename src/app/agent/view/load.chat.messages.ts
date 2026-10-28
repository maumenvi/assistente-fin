import { type ChatViewState } from './chat.view.state.ts';
import { CHAT_PAGE_SIZE } from './chat.page.size.ts';
import { type ViewMessage } from './view.message.ts';

/** Carrega uma conversa (mensagens em ordem cronologica) no estado da tela. */
export function loadChatMessages(state: ChatViewState, conversationId: string, messages: readonly ViewMessage[]): ChatViewState {
  const last = messages.at(-1);
  return {
    ...state,
    conversationId,
    messages,
    activeRun: null,
    canRetryLast: last?.role === 'assistant' && last.status !== 'complete',
    banner: null,
    hasOlder: messages.length >= CHAT_PAGE_SIZE,
    lastEvent: null,
  };
}
