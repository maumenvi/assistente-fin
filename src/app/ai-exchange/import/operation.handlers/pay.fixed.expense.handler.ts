import { z } from 'zod';
import { type OperationHandler, type Inspection, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { fixedExpenseRefs } from './fixed.expense.refs.ts';
import { imageOf, labelOf, versionOf } from './handler.support.ts';

/** `fixedExpense` + `pay` (spec 029, R3): marca pago ou nao pago; `data.paid` ausente = pago. */
export const payFixedExpenseHandler: OperationHandler = {
  entity: 'fixedExpense',
  kind: 'pay',
  dataSchema: z.object({ paid: z.boolean() }).strict(),
  destructiveFields: [],
  inspect: async (op, database, userId): Promise<Inspection> => {
    const fixed = op.id === undefined ? null : await database.fixedExpenses.findById(userId, op.id);
    if (fixed === null) return NOT_FOUND_INSPECTION;
    return {
      exists: true,
      version: versionOf(fixed.updatedAt),
      label: labelOf(fixed.description),
      display: { paid: fixed.paid, expectedAmountCents: fixed.expectedAmount.cents },
      refusal: null,
      affected: 1,
    };
  },
  execute: async (op, context) => {
    const id = op.id!;
    const paid = typeof op.data?.['paid'] === 'boolean' ? op.data['paid'] : true;
    const before = await captureJournalItems(context.database, context.userId, await fixedExpenseRefs(context.database, context.userId, id));
    await context.useCases.setFixedExpensePaid.execute({ id, userId: context.userId, paid });
    // pagar cria o lancamento do mes e desmarcar o remove: a imagem posterior le o que ficou
    const after = await captureJournalItems(context.database, context.userId, await fixedExpenseRefs(context.database, context.userId, id));
    return { entityId: id, before: imageOf(before), after: imageOf(after) };
  },
};
