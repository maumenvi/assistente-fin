/** Uma execucao em andamento: como pedir para parar e como esperar o fim. */
export interface ActiveRun {
  readonly runId: string;
  readonly conversationId: string;
  /** Dono da execucao (para encerrar as do usuario quando a sessao acaba). */
  readonly userId: string;
  readonly controller: AbortController;
  /** Resolve quando a execucao termina (sucesso, falha ou cancelamento); nunca rejeita. */
  settled: Promise<void>;
}
