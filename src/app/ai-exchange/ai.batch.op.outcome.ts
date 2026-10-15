/** O que aconteceu com cada operacao do lote (spec 029, data-model.md §2). */
export const AI_BATCH_OP_OUTCOMES = [
  'applied',
  'skipped_duplicate',
  'rejected',
  'pending_destructive',
  'undone',
  'undo_conflict',
] as const;

export type AiBatchOpOutcome = (typeof AI_BATCH_OP_OUTCOMES)[number];
