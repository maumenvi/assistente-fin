/**
 * Estados de uma execucao do agente (spec 031, data-model.md 1).
 *
 * `awaiting_approval` e RESERVADO a spec 033 (plano pendente de aprovacao): nesta spec nenhuma
 * execucao entra nele, mas o tipo ja o prev para a migracao nao precisar mexer na persistencia.
 */
export const RUN_STATUSES = ['running', 'done', 'interrupted', 'failed', 'cancelled', 'awaiting_approval'] as const;

/** Estado de uma execucao do agente. */
export type RunStatus = (typeof RUN_STATUSES)[number];
