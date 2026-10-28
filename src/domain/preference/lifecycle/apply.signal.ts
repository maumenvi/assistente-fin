import { defaultPrivate } from '../default.privacy.ts';
import { effectOfTopic } from '../effect.of.topic.ts';
import { type Preference } from '../preference.ts';
import { type PreferenceScope } from '../preference.scope.ts';
import { type PreferenceTopic } from '../preference.topic.ts';

/** Candidata proposta pelo aprendizado, com o total de sinais que a sustenta. */
export interface SignalDraft {
  readonly id: string;
  readonly userId: string;
  readonly text: string;
  readonly topic: PreferenceTopic;
  readonly scope: PreferenceScope;
  /** Total de sinais na janela (nao o incremento). */
  readonly evidence: number;
  readonly now: Date;
  readonly sourceConversationId?: string | null;
  readonly sourceMessageId?: string | null;
}

function confidenceOf(evidence: number): number {
  return Math.min(0.95, 0.3 + 0.15 * evidence);
}

/**
 * Cria ou reforca uma candidata (spec 032, FR-004/FR-006): estilo vira `tentative` (pode ser
 * aplicada, marcada); dados viram `candidate` (so valem depois de confirmar). Uma preferencia ja
 * `active` ou `disabled` nao muda - o aprendizado nunca reativa nem rebaixa o que o usuario decidiu.
 */
export function applySignal(existing: Preference | null, draft: SignalDraft): Preference {
  const at = draft.now.toISOString();
  if (existing !== null) {
    if (existing.status === 'active' || existing.status === 'disabled') return existing;
    return { ...existing, evidence: draft.evidence, confidence: confidenceOf(draft.evidence), updatedAt: at };
  }
  const effect = effectOfTopic(draft.topic, draft.scope);
  return {
    id: draft.id,
    userId: draft.userId,
    text: draft.text,
    topic: draft.topic,
    scope: draft.scope,
    origin: 'learned',
    status: effect === 'style' ? 'tentative' : 'candidate',
    effect,
    private: defaultPrivate(draft.scope),
    confidence: confidenceOf(draft.evidence),
    evidence: draft.evidence,
    supersededBy: null,
    createdAt: at,
    updatedAt: at,
    lastUsedAt: null,
    sourceConversationId: draft.sourceConversationId ?? null,
    sourceMessageId: draft.sourceMessageId ?? null,
    sourceMessageRemoved: false,
  };
}
