import { type PreferenceOverwriteStorePort } from './preference.overwrite.store.port.ts';
import { type PreferenceStorePort } from './preference.store.port.ts';
import { type SignalStorePort } from './signal.store.port.ts';
import { type SuppressionStorePort } from './suppression.store.port.ts';

/**
 * Armazenamento das preferencias (spec 032), exposto como `Database.preferences`. Tres
 * implementacoes: `fake`, `sqlite` (celular) e `prisma` (desktop). So `preferences` sincroniza.
 */
export interface PreferenceStoresPort {
  readonly preferences: PreferenceStorePort;
  readonly signals: SignalStorePort;
  readonly suppressions: SuppressionStorePort;
  readonly overwrites: PreferenceOverwriteStorePort;
  /** "Apagar tudo": preferencias, sinais, supressoes e sobrescritas do usuario. */
  deleteAll(userId: string): Promise<void>;
}
