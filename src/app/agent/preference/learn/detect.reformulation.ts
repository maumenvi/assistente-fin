import { isSensitiveTopic } from '../../../../domain/preference/guard/is.sensitive.topic.ts';
import { normalizeText } from '../../../../domain/preference/normalize.text.ts';
import { type LearningTurn } from './learning.turn.ts';
import { shingleSimilarity } from './shingle.similarity.ts';
import { type SignalDraft } from './signal.draft.ts';
import { STYLE_RULES } from './signal.rules.ts';

/** Janela entre a pergunta e a reformulacao. */
const WINDOW_MS = 3 * 60_000;
/** Similaridade minima para contar como a mesma pergunta. */
const MIN_SIMILARITY = 0.6;

/** Chave dos sinais de reformulacao sem estilo reconhecido: evidencia de insatisfacao, sem candidata. */
export const UNKNOWN_REFORMULATION_KEY = 'reformulation:unknown';

/**
 * Reformulacao (spec 032, FR-004): duas mensagens do usuario separadas por uma resposta do agente,
 * em ate 3 minutos e com similaridade >= 0,6. Se a segunda traz um pedido de estilo, o sinal usa a
 * chave dele (reforca a candidata); senao e `reformulation:unknown` (nunca vira candidata). Pura.
 */
export function detectReformulation(turns: readonly LearningTurn[]): SignalDraft[] {
  const out: SignalDraft[] = [];
  for (let i = 2; i < turns.length; i += 1) {
    const current = turns[i] as LearningTurn;
    const reply = turns[i - 1] as LearningTurn;
    const previous = turns[i - 2] as LearningTurn;
    if (current.role !== 'user' || reply.role !== 'assistant' || previous.role !== 'user') continue;
    if (isSensitiveTopic(current.text) || isSensitiveTopic(previous.text)) continue;
    if (new Date(current.at).getTime() - new Date(previous.at).getTime() > WINDOW_MS) continue;
    if (shingleSimilarity(current.text, previous.text) < MIN_SIMILARITY) continue;
    const text = normalizeText(current.text);
    const rule = STYLE_RULES.find((r) => r.pattern.test(text));
    out.push({ key: rule?.key ?? UNKNOWN_REFORMULATION_KEY, kind: 'reformulation', messageId: current.id, at: current.at });
  }
  return out;
}
