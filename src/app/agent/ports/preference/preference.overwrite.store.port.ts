import { type PreferenceOverwrite } from '../../../../domain/preference/preference.overwrite.ts';

/** Versoes sobrescritas pelo "ultima escrita vence" (spec 032, FR-010): locais ao aparelho. */
export interface PreferenceOverwriteStorePort {
  record(overwrite: PreferenceOverwrite): Promise<void>;
  get(userId: string, id: string): Promise<PreferenceOverwrite | null>;
  listUnseen(userId: string): Promise<PreferenceOverwrite[]>;
  markSeen(userId: string, ids: readonly string[], at: string): Promise<void>;
  deleteAll(userId: string): Promise<void>;
}
