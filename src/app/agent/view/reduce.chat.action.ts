import { CHAT_PAGE_SIZE } from './chat.page.size.ts';
import { addUserMessage } from './add.user.message.ts';
import { describeAgentError } from '../errors/describe.agent.error.ts';
import { bannerOfError } from './banner.of.error.ts';
import { type ChatAction } from './chat.action.ts';
import { type ChatViewState } from './chat.view.state.ts';
import { emptyChatState } from './empty.chat.state.ts';
import { loadChatMessages } from './load.chat.messages.ts';
import { reduceChat } from './reduce.chat.ts';

/** Reducer unico da tela de conversa (`useReducer`): junta eventos do agente e acoes da tela. */
export function reduceChatAction(state: ChatViewState, action: ChatAction): ChatViewState {
  switch (action.kind) {
    case 'event':
      return reduceChat(state, action.event);
    case 'loaded':
      return loadChatMessages(state, action.conversationId, action.messages);
    case 'older_loaded': {
      const known = new Set(state.messages.map((m) => m.id));
      const fresh = action.messages.filter((m) => !known.has(m.id));
      return { ...state, messages: [...fresh, ...state.messages], hasOlder: action.messages.length >= CHAT_PAGE_SIZE };
    }
    case 'user_sent':
      return addUserMessage(state, { id: action.id, text: action.text, ...(action.attachments === undefined ? {} : { attachments: action.attachments }) });
    case 'send_failed':
      // o envio nao saiu (sem modelo, sem consentimento...): tira a pergunta da lista e mostra a faixa
      return {
        ...state,
        messages: state.messages.filter((m) => m.id !== action.id),
        banner: bannerOfError(action.code) ?? { kind: 'send_error', text: describeAgentError(action.code) },
      };
    case 'reset':
      return emptyChatState();
    case 'restore':
      return action.state;
    case 'banner_dismissed':
      return { ...state, banner: null };
  }
}
