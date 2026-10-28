import { type Suppression } from '../../../../domain/preference/suppression.ts';

/** Recusas lembradas (spec 032, FR-007): locais ao aparelho. */
export interface SuppressionStorePort {
  /** Upsert por `(userId, key)`. */
  put(suppression: Suppression): Promise<void>;
  /** Suprimida enquanto `until > now` e a evidencia ainda nao chegou a `strongEvidenceNeeded`. */
  isSuppressed(userId: string, key: string, now: string, evidence: number): Promise<boolean>;
  deleteAll(userId: string): Promise<void>;
}
