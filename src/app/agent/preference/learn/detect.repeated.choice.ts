import { isSensitiveTopic } from '../../../../domain/preference/guard/is.sensitive.topic.ts';
import { normalizeText } from '../../../../domain/preference/normalize.text.ts';
import { type NamedEntity } from '../../../../domain/preference/select/select.context.ts';
import { type LearningTurn } from './learning.turn.ts';
import { type SignalDraft } from './signal.draft.ts';

/**
 * Escolha repetida (spec 032, FR-004): o usuario cita EXPLICITAMENTE a mesma conta em varios pedidos.
 * Um sinal `default_account:<id>` por mensagem que cita exatamente uma conta (citar duas e
 * comparacao, nao escolha). So le texto do usuario. Pura.
 */
export function detectRepeatedChoice(turns: readonly LearningTurn[], accounts: readonly NamedEntity[]): SignalDraft[] {
  const out: SignalDraft[] = [];
  for (const turn of turns) {
    if (turn.role !== 'user' || turn.text.trim() === '' || isSensitiveTopic(turn.text)) continue;
    const text = ` ${normalizeText(turn.text)} `;
    const cited = accounts.filter((a) => {
      const name = normalizeText(a.name);
      return name !== '' && text.includes(` ${name} `);
    });
    if (cited.length === 1) out.push({ key: `default_account:${(cited[0] as NamedEntity).id}`, kind: 'repeated_choice', messageId: turn.id, at: turn.at });
  }
  return out;
}
