/** Estados do ciclo de vida de uma preferencia (spec 032, data-model.md 1). */
export const PREFERENCE_STATUSES = ['active', 'tentative', 'candidate', 'disabled'] as const;

/**
 * - `active`: vale; - `tentative`: candidata de estilo aplicada como tentativa, marcada;
 * - `candidate`: aprendida e ainda nao confirmada (nao e aplicada se afeta dados);
 * - `disabled`: desativada, expirada ou substituida.
 */
export type PreferenceStatus = (typeof PREFERENCE_STATUSES)[number];
