import { recordInstallmentPurchaseInputSchema } from '../../../transaction/record.installment.purchase.input.schema.ts';
import { type OperationHandler, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { dataOf, imageOf } from './handler.support.ts';

/**
 * `installmentPurchase` + `create` (spec 029, U1): `amountCents` e o valor TOTAL da compra; o app
 * a divide em `installments` parcelas, uma por mes a partir de `date` (`buildInstallmentPlan`, o resto
 * de centavos nas primeiras). Uma parcela so vira lancamento comum.
 */
export const createInstallmentPurchaseHandler: OperationHandler = {
  entity: 'installmentPurchase',
  kind: 'create',
  dataSchema: recordInstallmentPurchaseInputSchema.omit({ userId: true }).strict(),
  destructiveFields: [],
  inspect: async () => NOT_FOUND_INSPECTION,
  execute: async (op, context) => {
    const created = await context.useCases.recordInstallmentPurchase.execute({ ...dataOf(op), userId: context.userId });
    const refs = [...created.map((transaction) => ({ entity: 'transaction' as const, id: transaction.id })), { entity: 'category' as const, id: created[0]!.categoryId }];
    const after = await captureJournalItems(context.database, context.userId, refs);
    return { entityId: created[0]!.id, before: null, after: imageOf(after) };
  },
};
