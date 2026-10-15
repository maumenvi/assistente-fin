import { updateIncomeInputSchema } from '../../../income/update.income.input.schema.ts';
import { type OperationHandler, type Inspection, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { imageOf, isoDay, labelOf, versionOf } from './handler.support.ts';

/** `income` + `update` (spec 029, R3): ajusta um ganho; mudar valor, data ou origem e destrutivo. */
export const updateIncomeHandler: OperationHandler = {
  entity: 'income',
  kind: 'update',
  dataSchema: updateIncomeInputSchema.omit({ id: true, userId: true, expectedUpdatedAt: true }).strict(),
  destructiveFields: ['amountCents', 'date', 'source'],
  inspect: async (op, database, userId): Promise<Inspection> => {
    const income = op.id === undefined ? null : await database.incomes.findById(userId, op.id);
    if (income === null) return NOT_FOUND_INSPECTION;
    return {
      exists: true,
      version: versionOf(income.updatedAt),
      label: labelOf(income.source),
      display: {
        amountCents: income.amount.cents,
        date: isoDay(income.date),
        source: income.source,
        notes: income.notes ?? null,
        categoryId: income.categoryId,
        accountId: income.accountId ?? null,
      },
      refusal: null,
      affected: 1,
    };
  },
  execute: async (op, context) => {
    const id = op.id!;
    const refs = [{ entity: 'income', id }] as const;
    const before = await captureJournalItems(context.database, context.userId, refs);
    const updated = await context.useCases.updateIncome.execute({ ...(op.data ?? {}), id, userId: context.userId });
    const after = await captureJournalItems(context.database, context.userId, [...refs, { entity: 'category', id: updated.categoryId }]);
    return { entityId: id, before: imageOf(before), after: imageOf(after) };
  },
};
