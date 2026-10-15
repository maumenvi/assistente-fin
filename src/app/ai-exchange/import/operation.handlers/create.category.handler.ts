import { createCategoryInputSchema } from '../../../category/create.category.input.schema.ts';
import { type OperationHandler, NOT_FOUND_INSPECTION } from '../operation.handler.ts';
import { captureJournalItems } from '../journal/capture.journal.items.ts';
import { dataOf, imageOf } from './handler.support.ts';

/** `category` + `create` (spec 029, R3): cria uma categoria. Categoria nao se apaga na v1, entao o desfazer a mantem. */
export const createCategoryHandler: OperationHandler = {
  entity: 'category',
  kind: 'create',
  dataSchema: createCategoryInputSchema.omit({ userId: true }).strict(),
  destructiveFields: [],
  inspect: async () => NOT_FOUND_INSPECTION,
  execute: async (op, context) => {
    const created = await context.useCases.createCategory.execute({ ...dataOf(op), userId: context.userId });
    const after = await captureJournalItems(context.database, context.userId, [{ entity: 'category', id: created.id }]);
    return { entityId: created.id, before: null, after: imageOf(after) };
  },
};
