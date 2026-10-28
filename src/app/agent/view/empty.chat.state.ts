import { type ChatViewState } from './chat.view.state.ts';

/** Tela de conversa sem nada carregado. */
export function emptyChatState(): ChatViewState {
  return { conversationId: null, messages: [], activeRun: null, canRetryLast: false, banner: null, hasOlder: false, fileRequests: [], lastEvent: null };
}
