import { type AttachmentPart } from '../../../domain/agent/attachment/attachment.part.ts';
import { type AgentEvent } from '../ports/events/agent.event.ts';
import { type ChatViewState } from './chat.view.state.ts';
import { type ViewMessage } from './view.message.ts';

/** Tudo que pode mudar o estado da tela de conversa: eventos do agente e acoes da propria tela. */
export type ChatAction =
  | { readonly kind: 'event'; readonly event: AgentEvent }
  | { readonly kind: 'loaded'; readonly conversationId: string; readonly messages: readonly ViewMessage[] }
  | { readonly kind: 'older_loaded'; readonly messages: readonly ViewMessage[] }
  | { readonly kind: 'user_sent'; readonly id: string; readonly text: string; readonly attachments?: readonly AttachmentPart[] }
  | { readonly kind: 'send_failed'; readonly id: string; readonly code: string | null }
  | { readonly kind: 'reset' }
  /** Volta a uma conversa que seguiu trabalhando em segundo plano (spec 040): troca o estado inteiro. */
  | { readonly kind: 'restore'; readonly state: ChatViewState }
  | { readonly kind: 'banner_dismissed' };
