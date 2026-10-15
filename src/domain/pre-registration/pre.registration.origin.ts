/** De onde veio um pre-registro (spec 022, FR-022). */
export const PRE_REGISTRATION_ORIGINS = ['manual', 'nfce', 'receipt', 'wallet', 'voice', 'simulation'] as const;

/** Um dos valores de `PRE_REGISTRATION_ORIGINS`. */
export type PreRegistrationOrigin = (typeof PRE_REGISTRATION_ORIGINS)[number];
