import { type OperationHandler, type Inspection, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { installmentGroupRefs } from './installment.group.refs.ts';
import { imageOf, isoDay, labelOf, versionOf } from './handler.support.ts';

/** Inspecao comum das operacoes sobre um grupo parcelado: tamanho, total e se o item e parcela. */
export async function inspectInstallmentGroup(
  op: { readonly id?: string | undefined },
  database: Parameters<OperationHandler['inspect']>[1],
  userId: string,
): Promise<Inspection> {
  const reference = op.id === undefined ? null : await database.transactions.findById(userId, op.id);
  if (reference === null) return NOT_FOUND_INSPECTION;
  if (reference.installmentGroupId === null) {
    return { ...NOT_FOUND_INSPECTION, exists: true, refusal: 'o item informado nao e uma parcela de compra parcelada' };
  }
  const group = await database.transactions.listByInstallmentGroup(userId, reference.installmentGroupId);
  return {
    exists: true,
    version: versionOf(reference.updatedAt),
    label: labelOf(reference.notes),
    display: {
      amountCents: group.reduce((total, member) => total + member.amount.cents, 0),
      installments: group.length,
      date: isoDay(reference.date),
    },
    refusal: null,
    affected: group.length,
  };
}

/** `installmentPurchase` + `delete` (spec 029, U1): apaga o grupo inteiro; `id` e o de qualquer parcela. Sempre destrutivo. */
export const deleteInstallmentGroupHandler: OperationHandler = {
  entity: 'installmentPurchase',
  kind: 'delete',
  dataSchema: null,
  destructiveFields: [],
  inspect: (op, database, userId) => inspectInstallmentGroup(op, database, userId),
  execute: async (op, context) => {
    const id = op.id!;
    const before = await captureJournalItems(context.database, context.userId, await installmentGroupRefs(context.database, context.userId, id));
    await context.useCases.deleteInstallmentGroup.execute({ transactionId: id, userId: context.userId });
    return { entityId: id, before: imageOf(before), after: null };
  },
};
