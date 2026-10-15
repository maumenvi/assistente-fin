/**
 * Forma canonica de um record para comparar conteudo entre bancos (spec 022, M1): chaves em ordem
 * e sem o dono (`userId`) - dois records iguais aqui representam o mesmo dado.
 */
export function canonicalRecord(record: unknown): string {
  return JSON.stringify(sortKeys(record, true));
}

function sortKeys(value: unknown, top: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => sortKeys(item, false));
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (top && key === 'userId') continue;
    const field = (value as Record<string, unknown>)[key];
    if (field !== undefined) out[key] = sortKeys(field, false);
  }
  return out;
}
