/**
 * O formulario tem alteracao nao salva? (spec 024, FR-016): compara os valores atuais com os de
 * quando o formulario abriu, estruturalmente (strings, numeros, booleanos, `null`, arrays e
 * objetos simples). Campo ausente e campo `undefined` contam como iguais; alterar e desfazer volta
 * a "sem alteracao".
 */
export function isDirty(initial: unknown, current: unknown): boolean {
  return !same(initial, current);
}

function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => same(item, b[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (!same(left[key], right[key])) return false;
  }
  return true;
}
