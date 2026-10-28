/** Estados do ciclo de vida de um plano (spec 033, data-model.md 1). */
export const PLAN_STATUSES = ['pending', 'approved', 'applied', 'rejected', 'expired', 'stale', 'reverted', 'partial'] as const;

/** `partial` = desfeito so em parte (itens editados depois foram pulados). */
export type PlanStatus = (typeof PLAN_STATUSES)[number];
