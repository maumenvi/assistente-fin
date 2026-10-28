/**
 * Interpreta o cabecalho `Retry-After` (segundos inteiros ou data HTTP) em milissegundos.
 * Devolve `null` se ausente, invalido ou no passado.
 */
export function parseRetryAfter(value: string | null, now: Date): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number.parseFloat(trimmed) * 1000);
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  const delta = at - now.getTime();
  return delta > 0 ? delta : null;
}
