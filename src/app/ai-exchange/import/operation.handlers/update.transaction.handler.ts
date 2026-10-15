import { updateTransactionInputSchema } from '../../../transaction/update.transaction.input.schema.ts';
import { type Database } from '../../../shared/database.port.ts';
import { type OperationHandler, type Inspection, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { type EntityRef } from '../journal/journal.refs.ts';
import { imageOf, isoDay, labelOf, versionOf } from './handler.support.ts';
import { refusalForUnsupportedTransaction } from './unsupported.transaction.ts';

/** Transacoes que um `update` toca: ela mesma, as irmas de uma compra parcelada e o ganho espelho. */
async function affectedRefs(database: Database, userId: string, id: string): Promise<EntityRef[]> {
  const transaction = await database.transactions.findById(userId, id);
  if (transaction === null) return [{ entity: 'transaction', id }];
  const group = transaction.installmentGroupId === null ? [transaction] : await database.transactions.listByInstallmentGroup(userId, transaction.installmentGroupId);
  const refs: EntityRef[] = [];
  for (const member of group) {
    refs.push({ entity: 'transaction', id: member.id });
    if (member.incomeId !== null) refs.push({ entity: 'income', id: member.incomeId });
  }
  return refs;
}

/**
 * `transaction` + `update` (spec 029, R3): ajusta um lancamento. Numa parcela, categoria e
 * observacoes propagam ao grupo (spec 020, RF-51) e o diario guarda todas as irmas (U1).
 */
export const updateTransactionHandler: OperationHandler = {
  entity: 'transaction',
  kind: 'update',
  dataSchema: updateTransactionInputSchema.omit({ id: true, userId: true, expectedUpdatedAt: true }).strict(),
  destructiveFields: ['amountCents', 'date', 'type'],
  inspect: async (op, database, userId): Promise<Inspection> => {
    const transaction = op.id === undefined ? null : await database.transactions.findById(userId, op.id);
    if (transaction === null) return NOT_FOUND_INSPECTION;
    return {
      exists: true,
      version: versionOf(transaction.updatedAt),
      label: labelOf(transaction.notes),
      display: {
        amountCents: transaction.amount.cents,
        date: isoDay(transaction.date),
        type: transaction.type,
        notes: transaction.notes ?? null,
        categoryId: transaction.categoryId,
        accountId: transaction.accountId,
      },
      refusal: refusalForUnsupportedTransaction(transaction, 'update'),
      affected: 1,
    };
  },
  execute: async (op, context) => {
    const id = op.id!;
    const refsBefore = await affectedRefs(context.database, context.userId, id);
    const before = await captureJournalItems(context.database, context.userId, refsBefore);
    await context.useCases.updateTransaction.execute({ ...(op.data ?? {}), id, userId: context.userId });
    const refsAfter = await affectedRefs(context.database, context.userId, id);
    const after = await captureJournalItems(context.database, context.userId, [...refsAfter, ...refsBefore]);
    return { entityId: id, before: imageOf(before), after: imageOf(after) };
  },
};
