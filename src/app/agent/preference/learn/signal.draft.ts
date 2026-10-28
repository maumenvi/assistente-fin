import { type LearningSignalKind } from '../../../../domain/preference/learning.signal.ts';

/** Sinal detectado, ainda sem id: o worker o grava de forma idempotente por `(messageId, key)`. */
export interface SignalDraft {
  readonly key: string;
  readonly kind: LearningSignalKind;
  readonly messageId: string;
  readonly at: string;
}
