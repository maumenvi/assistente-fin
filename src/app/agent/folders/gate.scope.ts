import { type AgentEventBody } from '../ports/events/agent.event.body.ts';

/** De quem e o pedido: o usuario da SESSAO, a conversa e a execucao que esperam a decisao. */
export interface GateScope {
  readonly userId: string;
  readonly conversationId: string;
  readonly runId: string;
  emit(body: AgentEventBody): void;
  /** Acumula o tempo de espera da pessoa (fora do orcamento de tempo da execucao). */
  readonly waited?: { ms: number } | undefined;
  readonly signal?: AbortSignal | undefined;
}
