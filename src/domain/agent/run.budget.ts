/**
 * Limites de uma execucao do agente (spec 031 FR-017, estendido na spec 038 FR-007/FR-008 com `maxTokens`).
 * Ao atingir qualquer um o agente pausa ordenadamente, informa o motivo, entrega o parcial e permite continuar.
 * O custo e em micro-dolares (inteiro) para nao acumular erro de ponto flutuante.
 */
export interface RunBudget {
  /** Maximo de nos executados no grafo (1..100). */
  readonly maxSteps: number;
  /** Maximo de tokens somados (entrada + saida) por pedido (1_000..500_000, padrao 24_000). */
  readonly maxTokens?: number | undefined;
  /** Tempo maximo total, em milissegundos (5_000..600_000). */
  readonly maxMs: number;
  /** Custo maximo estimado, em micro-dolares (1 US$ = 1.000.000). */
  readonly maxCostMicroUsd: number;
}
