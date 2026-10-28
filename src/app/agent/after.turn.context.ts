/** Identifica o turno que acabou de terminar (spec 032): o que as tarefas pos-turno precisam saber. */
export interface AfterTurnContext {
  readonly userId: string;
  readonly conversationId: string;
  readonly runId: string;
  readonly userMessageId: string;
  readonly assistantMessageId: string;
}
