import { type AttachmentPart } from '../../../domain/agent/attachment/attachment.part.ts';
import { type ChatViewState } from './chat.view.state.ts';

/** Mostra a pergunta na hora do envio (a mensagem real chega depois pelo armazenamento). */
export function addUserMessage(state: ChatViewState, message: { readonly id: string; readonly text: string; readonly attachments?: readonly AttachmentPart[] }): ChatViewState {
  return {
    ...state,
    messages: [...state.messages, { id: message.id, role: 'user', parts: [{ type: 'text', text: message.text }, ...(message.attachments ?? [])], status: 'complete', errorCode: null, seq: null, runId: null }],
    canRetryLast: false,
    banner: null,
  };
}
