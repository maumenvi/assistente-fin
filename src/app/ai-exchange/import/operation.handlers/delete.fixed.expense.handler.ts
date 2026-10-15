import { type OperationHandler, type Inspection, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { fixedExpenseRefs } from './fixed.expense.refs.ts';
import { imageOf, labelOf, versionOf } from './handler.support.ts';

/** `fixedExpense` + `delete` (spec 029, R3): apaga um gasto fixo (e o lancamento ligado a ele); sempre destrutivo. */
export const deleteFixedExpenseHandler: OperationHandler = {
  entity: 'fixedExpense',
  kind: 'delete',
  dataSchema: null,
  destructiveFields: [],
  inspect: async (op, database, userId): Promise<Inspection> => {
    const fixed = op.id === undefined ? null : await database.fixedExpenses.findById(userId, op.id);
    if (fixed === null) return NOT_FOUND_INSPECTION;
    return {
      exists: true,
      version: versionOf(fixed.updatedAt),
      label: labelOf(fixed.description),
      display: { expectedAmountCents: fixed.expectedAmount.cents, dueDay: fixed.dueDay, description: fixed.description },
      refusal: null,
      affected: 1,
    };
  },
  execute: async (op, context) => {
    const id = op.id!;
    const before = await captureJournalItems(context.database, context.userId, await fixedExpenseRefs(context.database, context.userId, id));
    await context.useCases.deleteFixedExpense.execute({ id, userId: context.userId });
    const after = await captureJournalItems(context.database, context.userId, await fixedExpenseRefs(context.database, context.userId, id));
    return { entityId: id, before: imageOf(before), after: imageOf(after) };
  },
};
