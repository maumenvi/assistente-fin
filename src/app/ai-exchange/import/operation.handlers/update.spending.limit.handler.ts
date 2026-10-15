import { updateSpendingLimitInputSchema } from '../../../spending-limit/update.spending.limit.input.schema.ts';
import { type OperationHandler, type Inspection, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { imageOf, versionOf } from './handler.support.ts';

/** `spendingLimit` + `update` (spec 029, R3): muda o valor maximo; mudar o valor e destrutivo. */
export const updateSpendingLimitHandler: OperationHandler = {
  entity: 'spendingLimit',
  kind: 'update',
  dataSchema: updateSpendingLimitInputSchema.omit({ id: true, userId: true, expectedUpdatedAt: true }).strict(),
  destructiveFields: ['maxAmountCents'],
  inspect: async (op, database, userId): Promise<Inspection> => {
    const limit = op.id === undefined ? null : await database.spendingLimits.findById(userId, op.id);
    if (limit === null) return NOT_FOUND_INSPECTION;
    return {
      exists: true,
      version: versionOf(limit.updatedAt),
      label: null,
      display: { maxAmountCents: limit.maxAmount.cents, categoryId: limit.categoryId },
      refusal: null,
      affected: 1,
    };
  },
  execute: async (op, context) => {
    const id = op.id!;
    const before = await captureJournalItems(context.database, context.userId, [{ entity: 'spendingLimit', id }]);
    const updated = await context.useCases.updateSpendingLimit.execute({ ...(op.data ?? {}), id, userId: context.userId });
    const after = await captureJournalItems(context.database, context.userId, [
      { entity: 'spendingLimit', id },
      { entity: 'category', id: updated.categoryId },
    ]);
    return { entityId: id, before: imageOf(before), after: imageOf(after) };
  },
};
