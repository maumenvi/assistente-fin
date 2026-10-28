import { z } from 'zod';
import { defineOperation } from './operation.adapter.ts';
import { safeCategoryName } from './operation.lookups.ts';

const input = z.object({ name: z.string().min(1).max(60) });

/** Criar uma categoria. */
export const categoryCreateOperation = defineOperation({
  kind: 'category.create',
  input,
  watch: () => Promise.resolve([]),
  validate: async (i, ctx) => {
    const name = safeCategoryName(i.name);
    if (name === null) return { invalid: `nome de categoria invalido: "${i.name}"` };
    return (await ctx.db.categories.findByName(ctx.userId, name)) === null ? { flags: [] } : { invalid: `a categoria "${i.name}" ja existe` };
  },
  preview: (i) => Promise.resolve({ label: `Criar categoria "${i.name}"`, before: null, after: [`Nome: ${safeCategoryName(i.name)?.value ?? i.name}`], amountCents: null }),
  apply: async (i, ctx) => {
    const category = await ctx.writers.createCategory.execute({ userId: ctx.userId, name: i.name });
    return [{ entity: 'category', id: category.id }];
  },
});
