function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key, v]) => v !== undefined && key !== 'updatedAt')
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, v]) => [key, sortKeys(v)]),
    );
  }
  return value;
}

/** JSON com chaves ordenadas, sem `undefined` nem `updatedAt`: "mesmo conteudo" (spec 022, FR-018). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
