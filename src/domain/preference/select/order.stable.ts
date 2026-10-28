import { type Preference } from '../preference.ts';

/** Ordem estavel (`createdAt`, `id`) para o prefixo do contexto nao mudar a toa (cache, FR-018). */
export function orderStable(prefs: readonly Preference[]): Preference[] {
  return [...prefs].sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)));
}
