/** Consumo acumulado de uma execucao (spec 031). Custo em micro-dolares, `null` quando desconhecido. */
export interface Consumed {
  readonly steps: number;
  readonly ms: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens: number;
  readonly costMicroUsd: number | null;
}
