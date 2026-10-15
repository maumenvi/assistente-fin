import { type AiBatchOp } from '../ai.batch.op.ts';
import { type AiBatchSummary } from '../ai.batch.summary.ts';

/** Conta o resultado de um lote a partir das suas operacoes (spec 029, FR-010). */
export function summarizeOps(ops: readonly AiBatchOp[]): AiBatchSummary {
  let created = 0;
  let updated = 0;
  let paid = 0;
  let duplicates = 0;
  let deleted = 0;
  let rejected = 0;
  let pendingDestructive = 0;
  for (const op of ops) {
    switch (op.outcome) {
      case 'applied':
      case 'undone':
      case 'undo_conflict':
        if (op.kind === 'create') created += 1;
        else if (op.kind === 'pay') paid += 1;
        else if (op.kind === 'delete' || op.kind === 'cancelRemaining') deleted += 1;
        else updated += 1;
        break;
      case 'skipped_duplicate':
        duplicates += 1;
        break;
      case 'rejected':
        rejected += 1;
        break;
      case 'pending_destructive':
        pendingDestructive += 1;
        break;
    }
  }
  return { created, updated, paid, duplicates, deleted, rejected, pendingDestructive };
}
