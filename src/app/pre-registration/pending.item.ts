import { type PreRegistrationField } from '../../domain/pre-registration/pre.registration.field.ts';

/** Tipos de pendencia do sino (spec 022, FR-029). */
export type PendingItemKind = 'pre-registration' | 'manual' | 'conflict';

/** Uma pendencia da lista do sino. */
export interface PendingItem {
  readonly id: string;
  readonly kind: PendingItemKind;
  readonly title: string;
  readonly subtitle: string;
  readonly createdAt: Date;
  /** Campos que faltam para aprovar (so pre-registro). */
  readonly missing: readonly PreRegistrationField[];
  readonly possibleDuplicate: boolean;
}
