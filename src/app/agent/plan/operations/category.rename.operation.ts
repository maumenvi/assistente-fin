import { z } from 'zod';
import { defineOperation } from './operation.adapter.ts';
import { safeCategoryName } from './operation.lookups.ts';

const input = z.object({ id: z.string().min(1), name: z.string().min(1).max(60) });

/** Renomear uma categoria (a mudanca vale para todos os lancamentos dela). */
export const categoryRenameOperation = defineOperation({
  kind: 'category.rename',
  input,
  watch: (i) => Promise.resolve([{ entity: 'category' as const, id: i.id }]),
  validate: async (i, ctx) => {
    const category = await ctx.db.categories.findById(ctx.userId, i.id);
    if (category === null) return { invalid: `categoria ${i.id} nao encontrada` };
    const name = safeCategoryName(i.name);
    if (name === null) return { invalid: `nome de categoria invalido: "${i.name}"` };
    const same = await ctx.db.categories.findByName(ctx.userId, name);
    return same !== null && same.id !== i.id ? { invalid: `ja existe a categoria "${i.name}"` } : { flags: [] };
  },
  preview: async (i, ctx) => {
    const category = await ctx.db.categories.findById(ctx.userId, i.id);
    return { label: `Renomear categoria "${category?.name.value ?? i.id}"`, before: [`Nome: ${category?.name.value ?? i.id}`], after: [`Nome: ${safeCategoryName(i.name)?.value ?? i.name}`], amountCents: null };
  },
  apply: async (i, ctx) => {
    await ctx.writers.renameCategory.execute({ userId: ctx.userId, id: i.id, name: i.name });
    return [];
  },
});
