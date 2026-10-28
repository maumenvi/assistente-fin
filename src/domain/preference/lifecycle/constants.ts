/** Sinais de mesma `key` que criam uma candidata (spec 032, SC-002: "tres sinais"). */
export const MIN_SIGNALS = 3;
/** Janela em que os sinais contam. */
export const SIGNAL_WINDOW_DAYS = 30;
/** Candidata/tentativa sem reforco expira depois disto. */
export const CANDIDATE_TTL_DAYS = 45;
/** Preferencia aprendida ativa sem uso e desativada depois disto. */
export const LEARNED_UNUSED_DAYS = 180;
/** Tempo em que uma recusa suprime a mesma sugestao. */
export const SUPPRESSION_DAYS = 90;
/** Sinais necessarios para vencer uma supressao (2x o minimo). */
export const STRONG_EVIDENCE = MIN_SIGNALS * 2;
/** Meia-vida da confianca sem reforco ou uso. */
export const HALF_LIFE_DAYS = 30;
/** Limites do texto de uma preferencia. */
export const MIN_TEXT_LENGTH = 3;
export const MAX_TEXT_LENGTH = 200;
