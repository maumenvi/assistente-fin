import { registerIncomeInputSchema } from '../../../income/register.income.input.schema.ts';
import { recurrenceInputSchema } from '../../../shared/recurrence.input.schema.ts';
import { type OperationHandler, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { dataOf, imageOf } from './handler.support.ts';

/** Recorrencia padrao do ganho quando o agente nao a informa: nao repete. */
const NO_RECURRENCE = { frequency: 'nao-repete' } as const;

/** `income` + `create` (spec 029, R3): registra um ganho; sem `recurrence` o ganho nao repete. */
export const createIncomeHandler: OperationHandler = {
  entity: 'income',
  kind: 'create',
  dataSchema: registerIncomeInputSchema.omit({ userId: true }).extend({ recurrence: recurrenceInputSchema.optional() }).strict(),
  destructiveFields: [],
  inspect: async () => NOT_FOUND_INSPECTION,
  execute: async (op, context) => {
    const created = await context.useCases.registerIncome.execute({ recurrence: NO_RECURRENCE, ...dataOf(op), userId: context.userId });
    const after = await captureJournalItems(context.database, context.userId, [
      { entity: 'income', id: created.id },
      { entity: 'category', id: created.categoryId },
    ]);
    return { entityId: created.id, before: null, after: imageOf(after) };
  },
};
