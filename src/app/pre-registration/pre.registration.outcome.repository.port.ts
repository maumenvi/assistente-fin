import { type PreRegistrationOutcome } from '../../domain/pre-registration/pre.registration.outcome.ts';

/** Porta dos destinos de pre-registro (spec 027, R6). */
export interface PreRegistrationOutcomeRepository {
  /** Grava (ou substitui) o destino do pre-registro. */
  record(outcome: PreRegistrationOutcome): Promise<void>;
  find(userId: string, preRegistrationId: string): Promise<PreRegistrationOutcome | null>;
  /** Apaga destinos anteriores a `before`; devolve quantos. */
  purgeBefore(userId: string, before: Date): Promise<number>;
}
