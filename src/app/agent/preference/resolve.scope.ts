import { normalizeText } from '../../../domain/preference/normalize.text.ts';
import { type PreferenceScope } from '../../../domain/preference/preference.scope.ts';
import { type NamedEntity } from '../../../domain/preference/select/select.context.ts';

/** Escopo pedido pelo modelo: `name` e o nome da conta ou da categoria. */
export interface ScopeRequest {
  readonly kind: 'global' | 'account' | 'category';
  readonly name?: string | undefined;
}

export type ResolvedScope =
  | { readonly ok: true; readonly scope: PreferenceScope; readonly label: string }
  | { readonly ok: false; readonly reason: 'not_found' | 'ambiguous'; readonly names: readonly string[] };

function mentions(haystack: string, name: string): boolean {
  const n = normalizeText(name);
  return n !== '' && ` ${haystack} `.includes(` ${n} `);
}

function findByName(entities: readonly NamedEntity[], name: string): NamedEntity | undefined {
  const wanted = normalizeText(name);
  return entities.find((e) => normalizeText(e.name) === wanted) ?? entities.find((e) => normalizeText(e.name).includes(wanted) && wanted.length >= 3);
}

/**
 * Escopo de uma preferencia (spec 032, research P5): o pedido explicito do modelo vence; sem ele,
 * a conta ou categoria citada no proprio texto define o escopo. Mais de uma citada e ambiguo (o
 * agente pergunta); nenhuma e global. Funcao pura.
 */
export function resolveScope(input: {
  readonly text: string;
  readonly request?: ScopeRequest | undefined;
  readonly accounts: readonly NamedEntity[];
  readonly categories: readonly NamedEntity[];
}): ResolvedScope {
  const { request, accounts, categories } = input;
  if (request !== undefined && request.kind !== 'global') {
    const pool = request.kind === 'account' ? accounts : categories;
    const found = request.name === undefined ? undefined : findByName(pool, request.name);
    if (found === undefined) return { ok: false, reason: 'not_found', names: pool.map((e) => e.name) };
    return { ok: true, scope: { kind: request.kind, id: found.id }, label: `${request.kind === 'account' ? 'conta' : 'categoria'} ${found.name}` };
  }
  if (request?.kind === 'global') return { ok: true, scope: { kind: 'global' }, label: 'global' };
  const text = normalizeText(input.text);
  const hits = [
    ...accounts.filter((a) => mentions(text, a.name)).map((a) => ({ kind: 'account' as const, ...a })),
    ...categories.filter((c) => mentions(text, c.name)).map((c) => ({ kind: 'category' as const, ...c })),
  ];
  if (hits.length === 0) return { ok: true, scope: { kind: 'global' }, label: 'global' };
  if (hits.length > 1) return { ok: false, reason: 'ambiguous', names: hits.map((h) => h.name) };
  const hit = hits[0]!;
  return { ok: true, scope: { kind: hit.kind, id: hit.id }, label: `${hit.kind === 'account' ? 'conta' : 'categoria'} ${hit.name}` };
}
