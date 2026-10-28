/**
 * Extrai de `args` os ids das entidades manipuladas (spec 017): chaves terminadas em `Id` ou
 * `Ids` com valor string (ou lista de strings, unida por virgula). Funcao pura.
 */
export function extractSubjectIds(args: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return result;
  for (const [key, value] of Object.entries(args)) {
    if (!/Ids?$/.test(key)) continue;
    if (typeof value === 'string') {
      result[key] = value;
    } else if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string')) {
      result[key] = value.join(',');
    }
  }
  return result;
}
