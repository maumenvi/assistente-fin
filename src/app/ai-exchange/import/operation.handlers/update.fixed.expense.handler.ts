import { updateFixedExpenseInputSchema } from '../../../fixed-expense/update.fixed.expense.input.schema.ts';
import { type OperationHandler, type Inspection, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { fixedExpenseRefs } from './fixed.expense.refs.ts';
import { imageOf, labelOf, versionOf } from './handler.support.ts';

/** `fixedExpense` + `update` (spec 029, R3): ajusta um gasto fixo; valor, dia e descricao sao destrutivos. */
export const updateFixedExpenseHandler: OperationHandler = {
  entity: 'fixedExpense',
  kind: 'update',
  dataSchema: updateFixedExpenseInputSchema.omit({ id: true, userId: true, expectedUpdatedAt: true }).strict(),
  destructiveFields: ['expectedAmountCents', 'dueDay', 'description'],
  inspect: async (op, database, userId): Promise<Inspection> => {
    const fixed = op.id === undefined ? null : await database.fixedExpenses.findById(userId, op.id);
    if (fixed === null) return NOT_FOUND_INSPECTION;
    return {
      exists: true,
      version: versionOf(fixed.updatedAt),
      label: labelOf(fixed.description),
      display: {
        expectedAmountCents: fixed.expectedAmount.cents,
        dueDay: fixed.dueDay,
        description: fixed.description,
        categoryId: fixed.categoryId,
        accountId: fixed.accountId,
        paid: fixed.paid,
      },
      refusal: null,
      affected: 1,
    };
  },
  execute: async (op, context) => {
    const id = op.id!;
    const refs = await fixedExpenseRefs(context.database, context.userId, id);
    const before = await captureJournalItems(context.database, context.userId, refs);
    const updated = await context.useCases.updateFixedExpense.execute({ ...(op.data ?? {}), id, userId: context.userId });
    const after = await captureJournalItems(context.database, context.userId, [
      ...(await fixedExpenseRefs(context.database, context.userId, id)),
      { entity: 'category', id: updated.categoryId },
    ]);
    return { entityId: id, before: imageOf(before), after: imageOf(after) };
  },
};
