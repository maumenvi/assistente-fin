/**
 * Media movel de uma serie de valores (spec 001, RF-19).
 *
 * Opera sobre `number[]` (centavos), nao `Money` - fica generica e simples de testar; a
 * conversao pra `Money` acontece em `monthly.forecast.ts`. Serie vazia => 0 (sem historico,
 * sem media).
 */
export function movingAverage(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round(sum / values.length);
}
