import { type Preference } from '../../../../domain/preference/preference.ts';
import { STYLE_RULES } from './signal.rules.ts';

/**
 * Chave de sinal que sustenta uma preferencia aprendida (inverso de `candidateTemplate`): usada para
 * lembrar a recusa (`Suppression`). Texto refinado pelo modelo ainda cai no mesmo topico/valor pela
 * regra do catalogo; sem regra, a propria combinacao topico+escopo.
 */
export function keyOfPreference(p: Preference): string {
  const byText = STYLE_RULES.find((r) => r.text === p.text);
  if (byText !== undefined) return byText.key;
  if (p.topic === 'default_account' && p.scope.kind === 'account') return `default_account:${p.scope.id}`;
  const byTopic = STYLE_RULES.filter((r) => r.topic === p.topic);
  if (byTopic.length === 1) return (byTopic[0] as (typeof STYLE_RULES)[number]).key;
  return `${p.topic}:${p.scope.kind === 'global' ? 'global' : p.scope.id}`;
}
