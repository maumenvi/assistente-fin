import { registerFixedExpenseInputSchema } from '../../../fixed-expense/register.fixed.expense.input.schema.ts';
import { type OperationHandler, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { dataOf, imageOf } from './handler.support.ts';

/** `fixedExpense` + `create` (spec 029, R3): cadastra um gasto fixo. */
export const createFixedExpenseHandler: OperationHandler = {
  entity: 'fixedExpense',
  kind: 'create',
  dataSchema: registerFixedExpenseInputSchema.omit({ userId: true }).strict(),
  destructiveFields: [],
  inspect: async () => NOT_FOUND_INSPECTION,
  execute: async (op, context) => {
    const created = await context.useCases.registerFixedExpense.execute({ ...dataOf(op), userId: context.userId });
    const after = await captureJournalItems(context.database, context.userId, [
      { entity: 'fixedExpense', id: created.id },
      { entity: 'category', id: created.categoryId },
    ]);
    return { entityId: created.id, before: null, after: imageOf(after) };
  },
};
