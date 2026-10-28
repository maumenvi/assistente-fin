import { type PreferenceEffect } from './preference.effect.ts';
import { type PreferenceOrigin } from './preference.origin.ts';
import { type PreferenceScope } from './preference.scope.ts';
import { type PreferenceStatus } from './preference.status.ts';
import { type PreferenceTopic } from './preference.topic.ts';

/**
 * Gosto ou jeito de fazer do usuario (spec 032, data-model.md 1). E a unica entidade desta spec
 * que sincroniza entre aparelhos e entra no backup; `updatedAt` e a versao do sync.
 */
export interface Preference {
  readonly id: string;
  readonly userId: string;
  /** Frase curta (3-200 caracteres), sem valores monetarios. */
  readonly text: string;
  readonly topic: PreferenceTopic;
  readonly scope: PreferenceScope;
  readonly origin: PreferenceOrigin;
  readonly status: PreferenceStatus;
  readonly effect: PreferenceEffect;
  /** Privada = nunca enviada a modelo da nuvem (FR-023). */
  readonly private: boolean;
  /** 0-1; `said` = 1; `learned` cresce com sinais e decai sem reforco. */
  readonly confidence: number;
  /** Quantidade de sinais que sustentam (so aprendidas). */
  readonly evidence: number;
  /** Id da preferencia que a substituiu num conflito. */
  readonly supersededBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastUsedAt: string | null;
  /** De onde veio (local ao aparelho de criacao). */
  readonly sourceConversationId: string | null;
  readonly sourceMessageId: string | null;
  /** A conversa de origem foi apagada pelo usuario; a preferencia permanece. */
  readonly sourceMessageRemoved: boolean;
}
