/** Converte dolares em micro-dolares inteiros (1 US$ = 1.000.000). Recusa valor negativo ou nao finito. */
export function usdToMicro(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new RangeError(`valor em dolares invalido: ${String(usd)}`);
  }
  return Math.round(usd * 1_000_000);
}
