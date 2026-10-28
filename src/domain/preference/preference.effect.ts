/**
 * O que a preferencia afeta (spec 032, FR-006): `style` = jeito de responder (tamanho, tom,
 * formato); `data` = dinheiro ou dados (conta padrao, categoria automatica, periodo).
 * Preferencia `data` nunca e aplicada antes de ativa.
 */
export const PREFERENCE_EFFECTS = ['style', 'data'] as const;

export type PreferenceEffect = (typeof PREFERENCE_EFFECTS)[number];
