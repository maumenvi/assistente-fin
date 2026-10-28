import { type PreferenceScope } from '../../../../domain/preference/preference.scope.ts';
import { type PreferenceTopic } from '../../../../domain/preference/preference.topic.ts';
import { type NamedEntity } from '../../../../domain/preference/select/select.context.ts';
import { STYLE_RULES } from './signal.rules.ts';

/** O que uma `key` de sinal sustenta como candidata: topico, escopo e o texto-padrao. */
export interface CandidateTemplate {
  readonly topic: PreferenceTopic;
  readonly scope: PreferenceScope;
  readonly text: string;
}

/**
 * Candidata sustentada por uma chave de sinal (spec 032, contracts/learning.md). Chaves de estilo vem
 * do catalogo; `default_account:<id>` vira "usar a conta X como padrao". Chave sem candidata (por
 * exemplo `reformulation:unknown`) devolve `null`: conta como evidencia, mas nao vira preferencia.
 */
export function candidateTemplate(key: string, accounts: readonly NamedEntity[]): CandidateTemplate | null {
  const rule = STYLE_RULES.find((r) => r.key === key);
  if (rule !== undefined) return { topic: rule.topic, scope: { kind: 'global' }, text: rule.text };
  if (key.startsWith('default_account:')) {
    const account = accounts.find((a) => a.id === key.slice('default_account:'.length));
    if (account === undefined) return null;
    return { topic: 'default_account', scope: { kind: 'account', id: account.id }, text: `Usar a conta ${account.name} como padrão nas consultas.` };
  }
  return null;
}
