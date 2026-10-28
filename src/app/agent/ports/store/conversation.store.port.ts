import { type Conversation } from '../../../../domain/agent/conversation.ts';

/** Conversas do agente. Todo acesso filtra pelo `userId` (usuario errado -> vazio/`null`). */
export interface ConversationStorePort {
  create(conversation: Conversation): Promise<void>;
  get(userId: string, id: string): Promise<Conversation | null>;
  /** Da mais recente para a mais antiga; `before` e o cursor (`lastMessageAt` da ultima linha). */
  list(userId: string, options: { readonly limit: number; readonly before?: string }): Promise<Conversation[]>;
  touch(userId: string, id: string, lastMessageAt: string): Promise<void>;
  /** Remove em cascata mensagens, execucoes e passos. */
  delete(userId: string, id: string): Promise<void>;
  deleteAll(userId: string): Promise<void>;
}
