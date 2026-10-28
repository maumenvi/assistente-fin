import { z } from 'zod';
import { defineOperation } from './operation.adapter.ts';
import { choiceLabel, accountLabel, categoryLabel, ensureCategory, resolveCategory } from './operation.lookups.ts';
import { moneyLine } from './money.line.ts';

const input = z.object({
  id: z.string().min(1),
  dueDay: z.int().min(1).max(31).optional(),
  expectedAmountCents: z.int().positive().optional(),
  accountId: z.string().min(1).optional(),
  description: z.string().max(200).optional(),
  referenceMonth: z.int().min(1).max(12).optional(),
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().min(1).optional(),
});

/** Editar um gasto fixo. */
export const fixedExpenseUpdateOperation = defineOperation({
  kind: 'fixedExpense.update',
  input,
  normalize: async (i, ctx) => {
    const { categoryId: _id, categoryName: _name, ...rest } = i;
    return { ...rest, ...(await resolveCategory(ctx, i)) };
  },
  watch: (i) => Promise.resolve([{ entity: 'fixedExpense' as const, id: i.id }]),
  validate: async (i, ctx) => {
    if ((await ctx.db.fixedExpenses.findById(ctx.userId, i.id)) === null) return { invalid: `gasto fixo ${i.id} nao encontrado` };
    if (Object.keys(i).length <= 1) return { invalid: 'nenhuma alteracao informada' };
    if (i.accountId !== undefined && (await ctx.db.accounts.findById(ctx.userId, i.accountId)) === null) return { invalid: `conta ${i.accountId} nao encontrada` };
    return { flags: [] };
  },
  preview: async (i, ctx) => {
    const fixed = await ctx.db.fixedExpenses.findById(ctx.userId, i.id);
    const before: string[] = [];
    const after: string[] = [];
    if (fixed !== null) {
      if (i.expectedAmountCents !== undefined) { before.push(moneyLine('Valor esperado', fixed.expectedAmount.cents)); after.push(moneyLine('Valor esperado', i.expectedAmountCents)); }
      if (i.dueDay !== undefined) { before.push(`Vence dia ${fixed.dueDay}`); after.push(`Vence dia ${i.dueDay}`); }
      if (i.accountId !== undefined) { before.push(`Conta: ${await accountLabel(ctx, fixed.accountId)}`); after.push(`Conta: ${await accountLabel(ctx, i.accountId)}`); }
      if (i.categoryId !== undefined || i.categoryName !== undefined) { before.push(`Categoria: ${await categoryLabel(ctx, fixed.categoryId)}`); after.push(`Categoria: ${await choiceLabel(ctx, i)}`); }
      if (i.description !== undefined) { before.push(`Descricao: ${fixed.description ?? '-'}`); after.push(`Descricao: ${i.description}`); }
    }
    return { label: `Editar gasto fixo${fixed?.description ? ` · ${fixed.description}` : ''}`, before, after, amountCents: i.expectedAmountCents ?? fixed?.expectedAmount.cents ?? null };
  },
  apply: async (i, ctx) => {
    const { categoryId, created } = await ensureCategory(ctx, i);
    const { categoryName: _name, categoryId: _id, ...rest } = i;
    await ctx.writers.updateFixedExpense.execute({ ...rest, userId: ctx.userId, ...(categoryId ? { categoryId } : {}) });
    return created;
  },
});
