/** Dependencias injetaveis da retentativa (relogio e sorteio), para testes deterministicos. */
export interface RetryDeps {
  readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Numero em [0, 1). */
  readonly random: () => number;
}
