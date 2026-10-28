/** De onde veio a preferencia: dita pelo usuario ou aprendida pelo agente (spec 032, FR-001). */
export const PREFERENCE_ORIGINS = ['said', 'learned'] as const;

export type PreferenceOrigin = (typeof PREFERENCE_ORIGINS)[number];
