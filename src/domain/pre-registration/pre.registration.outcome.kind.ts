/** O que aconteceu com um pre-registro que deixou de estar pendente (spec 027, R6). */
export const PRE_REGISTRATION_OUTCOME_KINDS = ['approved', 'discarded'] as const;

/** Um dos valores de `PRE_REGISTRATION_OUTCOME_KINDS`. */
export type PreRegistrationOutcomeKind = (typeof PRE_REGISTRATION_OUTCOME_KINDS)[number];
