import { type LearningSignal } from '../../../../domain/preference/learning.signal.ts';

/** Sinais de aprendizado (spec 032): locais ao aparelho, nunca sincronizam. */
export interface SignalStorePort {
  /** Idempotente por `(messageId, key)`. */
  append(signal: LearningSignal): Promise<void>;
  /** Sinais da `key` desde `since` (inclusive), do mais recente ao mais antigo. */
  listByKey(userId: string, key: string, since: string): Promise<LearningSignal[]>;
  countByKey(userId: string, key: string, since: string): Promise<number>;
  /** Remove os anteriores a `before` e, depois, os mais antigos acima de `keepMax`. */
  prune(userId: string, before: string, keepMax: number): Promise<void>;
  deleteAll(userId: string): Promise<void>;
}
