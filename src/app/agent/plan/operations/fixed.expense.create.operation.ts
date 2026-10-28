import { z } from 'zod';
import { formatBrl } from '../../verify/format.brl.ts';
import { defineOperation } from './operation.adapter.ts';
import { choiceLabel, accountLabel, categoryLabel, ensureCategory, resolveCategory } from './operation.lookups.ts';
import { moneyLine } from './money.line.ts';

const input = z.object({
  dueDay: z.int().min(1).max(31),
  expectedAmountCents: z.int().positive(),
  accountId: z.string().min(1),
  description: z.string().max(200).optional(),
  referenceMonth: z.int().min(1).max(12).optional(),
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().min(1).optional(),
});

/** Cadastrar um gasto fixo. */
export const fixedExpenseCreateOperation = defineOperation({
  kind: 'fixedExpense.create',
  input,
  normalize: async (i, ctx) => ({ ...i, categoryId: undefined, categoryName: undefined, ...(await resolveCategory(ctx, i)) }),
  watch: () => Promise.resolve([]),
  validate: async (i, ctx) => {
    const account = await ctx.db.accounts.findById(ctx.userId, i.accountId);
    if (account === null || account.archived) return { invalid: `conta ${i.accountId} nao encontrada` };
    return { flags: [] };
  },
  preview: async (i, ctx) => ({
    label: `Gasto fixo ${formatBrl(i.expectedAmountCents)}${i.description ? ` · ${i.description}` : ''}`,
    before: null,
    after: [moneyLine('Valor esperado', i.expectedAmountCents), `Vence dia ${i.dueDay}`, `Conta: ${await accountLabel(ctx, i.accountId)}`, ...(i.categoryId || i.categoryName ? [`Categoria: ${await choiceLabel(ctx, i)}`] : []), ...(i.description ? [`Descricao: ${i.description}`] : [])],
    amountCents: i.expectedAmountCents,
  }),
  apply: async (i, ctx) => {
    const { categoryId, created } = await ensureCategory(ctx, i);
    const fixed = await ctx.writers.registerFixedExpense.execute({
      userId: ctx.userId, dueDay: i.dueDay, expectedAmountCents: i.expectedAmountCents, accountId: i.accountId,
      ...(i.description ? { description: i.description } : {}), ...(i.referenceMonth ? { referenceMonth: i.referenceMonth } : {}), ...(categoryId ? { categoryId } : {}),
    });
    return [...created, { entity: 'fixedExpense', id: fixed.id }];
  },
});
