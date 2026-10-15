import { type OperationHandler } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { installmentGroupRefs } from './installment.group.refs.ts';
import { imageOf } from './handler.support.ts';
import { inspectInstallmentGroup } from './delete.installment.group.handler.ts';

/** `installmentPurchase` + `cancelRemaining` (spec 029, U1): cancela as parcelas ainda nao vencidas; sempre destrutivo. */
export const cancelRemainingInstallmentsHandler: OperationHandler = {
  entity: 'installmentPurchase',
  kind: 'cancelRemaining',
  dataSchema: null,
  destructiveFields: [],
  inspect: (op, database, userId) => inspectInstallmentGroup(op, database, userId),
  execute: async (op, context) => {
    const id = op.id!;
    const refs = await installmentGroupRefs(context.database, context.userId, id);
    const before = await captureJournalItems(context.database, context.userId, refs);
    await context.useCases.cancelRemainingInstallments.execute({ transactionId: id, userId: context.userId });
    // as parcelas que restaram: o desfazer devolve as canceladas e deixa estas como estao
    const after = await captureJournalItems(context.database, context.userId, refs);
    return { entityId: id, before: imageOf(before), after: imageOf(after) };
  },
};
