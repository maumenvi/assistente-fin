/** Conversa como a lista a mostra (igual ao DTO da IPC). */
export interface ConversationItem {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly lastMessageAt: string;
}
