import { setSpendingLimitInputSchema } from '../../../spending-limit/set.spending.limit.input.schema.ts';
import { toSpendingLimitRecord } from '../../../backup/backup.record.mapper.ts';
import { type JournalItem } from '../../journal.image.ts';
import { type OperationHandler, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { dataOf, imageOf, versionOf } from './handler.support.ts';

/**
 * `spendingLimit` + `create` (spec 029, R3): define o limite de uma categoria num mes. Se o caso
 * de uso reaproveitar um limite existente, o diario guarda o estado dele antes da chamada.
 */
export const createSpendingLimitHandler: OperationHandler = {
  entity: 'spendingLimit',
  kind: 'create',
  dataSchema: setSpendingLimitInputSchema.omit({ userId: true }).strict(),
  destructiveFields: [],
  inspect: async () => NOT_FOUND_INSPECTION,
  execute: async (op, context) => {
    const existing = await context.database.spendingLimits.listByUser(context.userId);
    const created = await context.useCases.setSpendingLimit.execute({ ...dataOf(op), userId: context.userId });
    const previous = existing.find((limit) => limit.id === created.id);
    const before: JournalItem[] =
      previous === undefined ? [] : [{ entity: 'spendingLimit', record: toSpendingLimitRecord(previous), version: versionOf(previous.updatedAt) }];
    const after = await captureJournalItems(context.database, context.userId, [
      { entity: 'spendingLimit', id: created.id },
      { entity: 'category', id: created.categoryId },
    ]);
    return { entityId: created.id, before: imageOf(before), after: imageOf(after) };
  },
};
