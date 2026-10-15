import { recordTransactionInputSchema } from '../../../transaction/record.transaction.input.schema.ts';
import { type OperationHandler, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { type EntityRef } from '../journal/journal.refs.ts';
import { dataOf, imageOf } from './handler.support.ts';

/** `transaction` + `create` (spec 029, R3): registra um lancamento pelo mesmo caso de uso do app. */
export const createTransactionHandler: OperationHandler = {
  entity: 'transaction',
  kind: 'create',
  dataSchema: recordTransactionInputSchema.omit({ userId: true, recurrence: true }).strict(),
  destructiveFields: [],
  inspect: async () => NOT_FOUND_INSPECTION,
  execute: async (op, context) => {
    const created = await context.useCases.recordTransaction.execute({ ...dataOf(op), userId: context.userId });
    // um lancamento de entrada cria um ganho espelho; categoria por nome pode criar a categoria
    const refs: EntityRef[] = [{ entity: 'transaction', id: created.id }, { entity: 'category', id: created.categoryId }];
    if (created.incomeId !== null) refs.push({ entity: 'income', id: created.incomeId });
    const after = await captureJournalItems(context.database, context.userId, refs);
    return { entityId: created.id, before: null, after: imageOf(after) };
  },
};
