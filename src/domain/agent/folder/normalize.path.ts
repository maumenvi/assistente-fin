/** Normaliza para barras `/`, sem barra final nem `.`; nao resolve `..` (isso e recusado, nao "corrigido"). */
export function normalizePath(path: string): string {
  const slashed = path.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const parts = slashed.split('/').filter((p, i) => p !== '.' && (p !== '' || i === 0));
  const joined = parts.join('/');
  return joined.length > 1 && joined.endsWith('/') ? joined.slice(0, -1) : joined;
}
