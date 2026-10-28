import { type Preference } from '../preference.ts';

/**
 * Pode ir ao modelo? Privada nunca vai a modelo da nuvem; com modelo local entra (spec 032,
 * FR-012/FR-023). `cloud` = o perfil do turno exige consentimento de nuvem.
 */
export function isSendable(pref: Preference, cloud: boolean): boolean {
  return !(pref.private && cloud);
}
