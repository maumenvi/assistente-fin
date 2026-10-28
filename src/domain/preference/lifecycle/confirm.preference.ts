import { type Preference } from '../preference.ts';

/** Confirmacao do usuario: a candidata ou tentativa passa a `active` (spec 032, FR-005/FR-006). */
export function confirmPreference(pref: Preference, now: Date): Preference {
  return { ...pref, status: 'active', confidence: Math.max(pref.confidence, 0.9), supersededBy: null, updatedAt: now.toISOString() };
}
