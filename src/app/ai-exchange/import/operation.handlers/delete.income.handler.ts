import { type OperationHandler, type Inspection, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { imageOf, isoDay, labelOf, versionOf } from './handler.support.ts';

/** `income` + `delete` (spec 029, R3): apaga um ganho; sempre destrutivo. */
export const deleteIncomeHandler: OperationHandler = {
  entity: 'income',
  kind: 'delete',
  dataSchema: null,
  destructiveFields: [],
  inspect: async (op, database, userId): Promise<Inspection> => {
    const income = op.id === undefined ? null : await database.incomes.findById(userId, op.id);
    if (income === null) return NOT_FOUND_INSPECTION;
    return {
      exists: true,
      version: versionOf(income.updatedAt),
      label: labelOf(income.source),
      display: { amountCents: income.amount.cents, date: isoDay(income.date), source: income.source },
      refusal: null,
      affected: 1,
    };
  },
  execute: async (op, context) => {
    const id = op.id!;
    const before = await captureJournalItems(context.database, context.userId, [{ entity: 'income', id }]);
    await context.useCases.deleteIncome.execute({ id, userId: context.userId });
    return { entityId: id, before: imageOf(before), after: null };
  },
};
