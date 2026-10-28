import { isSensitiveTopic } from '../../../../domain/preference/guard/is.sensitive.topic.ts';
import { normalizeText } from '../../../../domain/preference/normalize.text.ts';
import { type LearningTurn } from './learning.turn.ts';
import { type SignalDraft } from './signal.draft.ts';
import { STYLE_RULES } from './signal.rules.ts';

/**
 * Feedback de estilo ("mais curto", "sem emoji"...) nas mensagens do USUARIO (spec 032, FR-004).
 * Pura e deterministica. Texto sensivel (FR-008) nao gera sinal. Um sinal por regra e por mensagem.
 */
export function detectStyleFeedback(turns: readonly LearningTurn[]): SignalDraft[] {
  const out: SignalDraft[] = [];
  for (const turn of turns) {
    if (turn.role !== 'user' || turn.text.trim() === '' || isSensitiveTopic(turn.text)) continue;
    const text = normalizeText(turn.text);
    for (const rule of STYLE_RULES) {
      if (rule.pattern.test(text)) out.push({ key: rule.key, kind: 'style_feedback', messageId: turn.id, at: turn.at });
    }
  }
  return out;
}
