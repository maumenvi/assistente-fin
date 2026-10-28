/** Conversa de um usuario com o agente (spec 031, data-model.md 1). */
export interface Conversation {
  readonly id: string;
  readonly userId: string;
  /** Primeira pergunta truncada em 60 caracteres (`makeConversationTitle`). */
  readonly title: string;
  /** `deleted` = apagada pelo usuario (a remocao fisica e em cascata). */
  readonly status: 'active' | 'deleted';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastMessageAt: string;
}
