import { type Preference } from '../preference.ts';
import { type Suppression } from '../suppression.ts';
import { STRONG_EVIDENCE, SUPPRESSION_DAYS } from './constants.ts';

/** Resultado de recusar uma sugestao: a preferencia desativada e a recusa a lembrar. */
export interface Dismissed {
  readonly preference: Preference;
  readonly suppression: Suppression;
}

/**
 * Recusa de uma sugestao (spec 032, FR-007): desativa a candidata e lembra a recusa por 90 dias;
 * so evidencia forte (6 sinais) volta a sugerir a mesma coisa.
 */
export function dismissPreference(pref: Preference, key: string, now: Date): Dismissed {
  const until = new Date(now.getTime() + SUPPRESSION_DAYS * 86_400_000).toISOString();
  return {
    preference: { ...pref, status: 'disabled', updatedAt: now.toISOString() },
    suppression: { userId: pref.userId, key, until, strongEvidenceNeeded: STRONG_EVIDENCE },
  };
}
