import { type Preference } from '../preference.ts';
import { CANDIDATE_TTL_DAYS, LEARNED_UNUSED_DAYS } from './constants.ts';
import { daysBetween } from './days.between.ts';

/**
 * Expiracao por tempo (spec 032, FR-007): candidata/tentativa sem reforco por 45 dias e aprendida
 * ativa sem uso por 180 dias viram `disabled`. A dita nunca expira por tempo.
 */
export function expirePreference(pref: Preference, now: Date): Preference {
  if (pref.origin === 'said') return pref;
  if (pref.status === 'candidate' || pref.status === 'tentative') {
    return daysBetween(pref.updatedAt, now) > CANDIDATE_TTL_DAYS ? { ...pref, status: 'disabled', updatedAt: now.toISOString() } : pref;
  }
  if (pref.status === 'active') {
    const reference = pref.lastUsedAt ?? pref.updatedAt;
    return daysBetween(reference, now) > LEARNED_UNUSED_DAYS ? { ...pref, status: 'disabled', updatedAt: now.toISOString() } : pref;
  }
  return pref;
}
