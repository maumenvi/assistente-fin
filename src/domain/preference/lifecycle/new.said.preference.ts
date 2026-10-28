import { defaultPrivate } from '../default.privacy.ts';
import { effectOfTopic } from '../effect.of.topic.ts';
import { type Preference } from '../preference.ts';
import { type PreferenceScope } from '../preference.scope.ts';
import { type PreferenceTopic } from '../preference.topic.ts';

/** Dados para criar uma preferencia dita pelo usuario. */
export interface NewSaidPreferenceInput {
  readonly id: string;
  readonly userId: string;
  readonly text: string;
  readonly topic: PreferenceTopic;
  readonly scope: PreferenceScope;
  readonly private?: boolean;
  readonly now: Date;
  readonly sourceConversationId?: string | null;
  readonly sourceMessageId?: string | null;
}

/**
 * Preferencia dita pelo proprio usuario: vale na hora, mesmo quando afeta dados (spec 032,
 * FR-001a). A privacidade segue o padrao do escopo, salvo escolha explicita.
 */
export function newSaidPreference(input: NewSaidPreferenceInput): Preference {
  const at = input.now.toISOString();
  return {
    id: input.id,
    userId: input.userId,
    text: input.text.trim(),
    topic: input.topic,
    scope: input.scope,
    origin: 'said',
    status: 'active',
    effect: effectOfTopic(input.topic, input.scope),
    private: input.private ?? defaultPrivate(input.scope),
    confidence: 1,
    evidence: 0,
    supersededBy: null,
    createdAt: at,
    updatedAt: at,
    lastUsedAt: null,
    sourceConversationId: input.sourceConversationId ?? null,
    sourceMessageId: input.sourceMessageId ?? null,
    sourceMessageRemoved: false,
  };
}
