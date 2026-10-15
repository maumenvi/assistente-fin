/** Estado de um lote no diario (spec 029, data-model.md §2). */
export const AI_BATCH_STATUSES = ['applied', 'partially_applied', 'undone', 'rejected'] as const;

export type AiBatchStatus = (typeof AI_BATCH_STATUSES)[number];
