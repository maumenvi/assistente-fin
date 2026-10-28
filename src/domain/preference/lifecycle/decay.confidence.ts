import { type Preference } from '../preference.ts';
import { daysBetween } from './days.between.ts';
import { HALF_LIFE_DAYS } from './constants.ts';

/**
 * Confianca atual: so as aprendidas decaem, com meia-vida de 30 dias contada do ultimo reforco
 * ou uso (spec 032, FR-007). A dita nao decai.
 */
export function decayConfidence(pref: Preference, now: Date): number {
  if (pref.origin === 'said') return pref.confidence;
  const reference = pref.lastUsedAt !== null && pref.lastUsedAt > pref.updatedAt ? pref.lastUsedAt : pref.updatedAt;
  return pref.confidence * Math.pow(0.5, daysBetween(reference, now) / HALF_LIFE_DAYS);
}
