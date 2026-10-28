/** Politica de retentativa (spec 031, D5). */
export interface RetryOptions {
  /** Retentativas alem da primeira tentativa. */
  readonly maxRetries: number;
  /** Atraso base de cada retentativa, em ms (a ultima se repete se faltar). */
  readonly delaysMs: readonly number[];
  /** Variacao aleatoria do atraso (0.2 = +-20%). */
  readonly jitter: number;
  /** Teto do `Retry-After` do provedor, em ms. */
  readonly maxRetryAfterMs: number;
}
