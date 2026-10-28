import { type MessagePart } from './message.part.ts';

/** Estado de uma mensagem; so as do assistente saem de `complete`. */
export type MessageStatus = 'complete' | 'streaming' | 'interrupted' | 'error';

/** Mensagem de uma conversa do agente (spec 031, data-model.md 1). */
export interface AgentMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly userId: string;
  /** Ordem dentro da conversa, crescente e sem lacunas. */
  readonly seq: number;
  readonly role: 'user' | 'assistant';
  readonly parts: readonly MessagePart[];
  readonly status: MessageStatus;
  /** Execucao que gerou a mensagem do assistente. */
  readonly runId: string | null;
  readonly errorCode: string | null;
  readonly createdAt: string;
}
