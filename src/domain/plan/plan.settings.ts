/** Validade do plano pendente e janela do desfazer: padroes e limites (spec 033, data-model.md 5). */
export const DEFAULT_VALIDITY_HOURS = 24;
export const DEFAULT_UNDO_DAYS = 7;
export const VALIDITY_HOURS_RANGE = { min: 1, max: 168 } as const;
export const UNDO_DAYS_RANGE = { min: 1, max: 30 } as const;
/** Itens por plano. */
export const MAX_PLAN_ITEMS = 200;
/** Confianca minima para o item vir marcado. */
export const MIN_SELECT_CONFIDENCE = 0.7;
