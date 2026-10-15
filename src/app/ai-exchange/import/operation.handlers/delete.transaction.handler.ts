import { type OperationHandler, type Inspection, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { type EntityRef } from '../journal/journal.refs.ts';
import { imageOf, isoDay, labelOf, versionOf } from './handler.support.ts';
import { refusalForUnsupportedTransaction } from './unsupported.transaction.ts';

/** `transaction` + `delete` (spec 029, R3): apaga um lancamento simples; sempre destrutivo. */
export const deleteTransactionHandler: OperationHandler = {
  entity: 'transaction',
  kind: 'delete',
  dataSchema: null,
  destructiveFields: [],
  inspect: async (op, database, userId): Promise<Inspection> => {
    const transaction = op.id === undefined ? null : await database.transactions.findById(userId, op.id);
    if (transaction === null) return NOT_FOUND_INSPECTION;
    return {
      exists: true,
      version: versionOf(transaction.updatedAt),
      label: labelOf(transaction.notes),
      display: { amountCents: transaction.amount.cents, date: isoDay(transaction.date), type: transaction.type, notes: transaction.notes ?? null },
      refusal: refusalForUnsupportedTransaction(transaction, 'delete'),
      affected: 1,
    };
  },
  execute: async (op, context) => {
    const id = op.id!;
    const found = await context.database.transactions.findById(context.userId, id);
    const refs: EntityRef[] = [{ entity: 'transaction', id }];
    if (found?.incomeId !== null && found?.incomeId !== undefined) refs.push({ entity: 'income', id: found.incomeId });
    const before = await captureJournalItems(context.database, context.userId, refs);
    await context.useCases.deleteTransaction.execute({ id, userId: context.userId });
    return { entityId: id, before: imageOf(before), after: null };
  },
};
