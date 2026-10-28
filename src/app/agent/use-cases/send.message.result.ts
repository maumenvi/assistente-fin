/** O que `SendMessage` devolve na hora; o resto da resposta chega por eventos. */
export interface SendMessageResult {
  readonly conversationId: string;
  readonly runId: string;
}
