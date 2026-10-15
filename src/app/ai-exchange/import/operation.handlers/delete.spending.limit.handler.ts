import { type OperationHandler, type Inspection, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { imageOf, versionOf } from './handler.support.ts';

/** `spendingLimit` + `delete` (spec 029, R3): apaga o limite de um mes; sempre destrutivo. */
export const deleteSpendingLimitHandler: OperationHandler = {
  entity: 'spendingLimit',
  kind: 'delete',
  dataSchema: null,
  destructiveFields: [],
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
    await context.useCases.deleteSpendingLimit.execute({ id, userId: context.userId });
    return { entityId: id, before: imageOf(before), after: null };
  },
};
