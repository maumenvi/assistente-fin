import { z } from 'zod';
import { defineOperation } from './operation.adapter.ts';
import { choiceLabel, accountLabel, categoryLabel, ensureCategory, resolveCategory } from './operation.lookups.ts';
import { dateLine, moneyLine } from './money.line.ts';

const input = z.object({
  id: z.string().min(1),
  date: z.iso.date().optional(),
  amountCents: z.int().positive().optional(),
  source: z.string().min(1).max(120).optional(),
  accountId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().min(1).optional(),
  notes: z.string().max(120).optional(),
});

/** Editar um ganho. */
export const incomeUpdateOperation = defineOperation({
  kind: 'income.update',
  input,
  normalize: async (i, ctx) => {
    const { categoryId: _id, categoryName: _name, ...rest } = i;
    return { ...rest, ...(await resolveCategory(ctx, i)) };
  },
  watch: (i) => Promise.resolve([{ entity: 'income' as const, id: i.id }]),
  validate: async (i, ctx) => {
    const income = await ctx.db.incomes.findById(ctx.userId, i.id);
    if (income === null) return { invalid: `ganho ${i.id} nao encontrado` };
    if (Object.keys(i).length <= 1) return { invalid: 'nenhuma alteracao informada' };
    if (i.accountId !== undefined && (await ctx.db.accounts.findById(ctx.userId, i.accountId)) === null) return { invalid: `conta ${i.accountId} nao encontrada` };
    return { flags: [] };
  },
  preview: async (i, ctx) => {
    const income = await ctx.db.incomes.findById(ctx.userId, i.id);
    const before: string[] = [];
    const after: string[] = [];
    if (income !== null) {
      if (i.amountCents !== undefined) { before.push(moneyLine('Valor', income.amount.cents)); after.push(moneyLine('Valor', i.amountCents)); }
      if (i.date !== undefined) { before.push(dateLine('Data', income.date.toISOString())); after.push(dateLine('Data', i.date)); }
      if (i.source !== undefined) { before.push(`Origem: ${income.source}`); after.push(`Origem: ${i.source}`); }
      if (i.accountId !== undefined) { before.push(`Conta: ${income.accountId ? await accountLabel(ctx, income.accountId) : '-'}`); after.push(`Conta: ${await accountLabel(ctx, i.accountId)}`); }
      if (i.categoryId !== undefined || i.categoryName !== undefined) { before.push(`Categoria: ${await categoryLabel(ctx, income.categoryId)}`); after.push(`Categoria: ${await choiceLabel(ctx, i)}`); }
      if (i.notes !== undefined) { before.push(`Descricao: ${income.notes ?? '-'}`); after.push(`Descricao: ${i.notes}`); }
    }
    return { label: `Editar ganho${income ? ` · ${income.source}` : ''}`, before, after, amountCents: i.amountCents ?? income?.amount.cents ?? null };
  },
  apply: async (i, ctx) => {
    const { categoryId, created } = await ensureCategory(ctx, i);
    const { categoryName: _name, categoryId: _id, ...rest } = i;
    await ctx.writers.updateIncome.execute({ ...rest, userId: ctx.userId, ...(categoryId ? { categoryId } : {}) });
    return created;
  },
});
