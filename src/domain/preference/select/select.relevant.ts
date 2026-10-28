import { normalizeText } from '../normalize.text.ts';
import { type Preference } from '../preference.ts';
import { type SelectContext } from './select.context.ts';

function mentions(haystack: string, name: string): boolean {
  const n = normalizeText(name);
  return n !== '' && ` ${haystack} `.includes(` ${n} `);
}

/**
 * Preferencias relevantes ao pedido (spec 032, FR-002/FR-012): as `active` globais; as `active` de
 * conta ou categoria so quando o pedido ou a rodada citam a entidade; as `tentative` de estilo.
 * `candidate`, `disabled` e qualquer preferencia de dados fora de `active` nunca entram.
 */
export function selectRelevant(prefs: readonly Preference[], ctx: SelectContext): Preference[] {
  const text = normalizeText([...ctx.history, ctx.userText].join(' '));
  const accountIds = new Set(ctx.accounts.filter((a) => mentions(text, a.name)).map((a) => a.id));
  const categoryIds = new Set(ctx.categories.filter((c) => mentions(text, c.name)).map((c) => c.id));
  return prefs.filter((p) => {
    if (p.status === 'tentative' && p.effect !== 'style') return false;
    if (p.status !== 'active' && p.status !== 'tentative') return false;
    if (p.scope.kind === 'global') return true;
    return p.scope.kind === 'account' ? accountIds.has(p.scope.id) : categoryIds.has(p.scope.id);
  });
}
