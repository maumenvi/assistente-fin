/** Campos comuns a todo evento do agente. `seq` e um contador por execucao (ordena e descarta repeticao/atraso). */
export interface AgentEventBase {
  readonly runId: string;
  readonly conversationId: string;
  readonly seq: number;
}
