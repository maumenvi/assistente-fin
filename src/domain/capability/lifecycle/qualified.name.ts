/** Slug: minusculas, digitos e hifen, 2 a 40 caracteres. */
const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG.test(slug);
}

/** Slug livre: valido e sem colidir com `app` nem com o id de uma ferramenta do app (a do app sempre prevalece - FR-013). */
export function isSlugAvailable(slug: string, appToolIds: readonly string[]): boolean {
  return isValidSlug(slug) && slug !== 'app' && !appToolIds.includes(slug.replace(/-/g, '_'));
}

/** Nome qualificado de uma ferramenta externa: `<slug>.<ferramenta>`. */
export function qualifiedName(slug: string, tool: string): string {
  return `${slug}.${tool}`;
}

/** Separa `<slug>.<ferramenta>`; `null` se nao tem o formato (ferramenta pode conter pontos). */
export function parseQualifiedName(name: string): { slug: string; tool: string } | null {
  const dot = name.indexOf('.');
  if (dot <= 0 || dot === name.length - 1) return null;
  const slug = name.slice(0, dot);
  return isValidSlug(slug) ? { slug, tool: name.slice(dot + 1) } : null;
}
