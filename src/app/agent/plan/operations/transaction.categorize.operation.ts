import { z } from 'zod';
import { defineOperation } from './operation.adapter.ts';
import { choiceLabel, categoryLabel, ensureCategory, resolveCategory, transactionBlockReason } from './operation.lookups.ts';
import { moneyLine } from './money.line.ts';

const input = z
  .object({ id: z.string().min(1), categoryId: z.string().min(1).optional(), categoryName: z.string().min(1).optional() })
  .refine((v) => v.categoryId !== undefined || v.categoryName !== undefined, { message: 'informe categoryId ou categoryName' });

/** Classificar um lancamento numa categoria. */
export const transactionCategorizeOperation = defineOperation({
  kind: 'transaction.categorize',
  input,
  normalize: async (i, ctx) => ({ id: i.id, ...(await resolveCategory(ctx, i)) }),
  watch: (i) => Promise.resolve([{ entity: 'transaction' as const, id: i.id }]),
  validate: async (i, ctx) => {
    const tx = await ctx.db.transactions.findById(ctx.userId, i.id);
    if (tx === null) return { invalid: `lancamento ${i.id} nao encontrado` };
    const blocked = transactionBlockReason(tx);
    if (blocked !== null) return { invalid: blocked };
    if (i.categoryId !== undefined && (await ctx.db.categories.findById(ctx.userId, i.categoryId)) === null) return { invalid: `categoria ${i.categoryId} nao encontrada` };
    return { flags: [] };
  },
  preview: async (i, ctx) => {
    const tx = await ctx.db.transactions.findById(ctx.userId, i.id);
    return {
      label: `Classificar${tx?.notes ? ` "${tx.notes}"` : ' lancamento'}`,
      before: tx ? [`Categoria: ${await categoryLabel(ctx, tx.categoryId)}`, moneyLine('Valor', tx.amount.cents)] : null,
      after: [`Categoria: ${await choiceLabel(ctx, i)}`],
      amountCents: tx?.amount.cents ?? null,
    };
  },
  apply: async (i, ctx) => {
    const { categoryId, created } = await ensureCategory(ctx, i);
    await ctx.writers.classifyTransaction.execute({ userId: ctx.userId, id: i.id, ...(categoryId ? { categoryId } : {}) });
    return created;
  },
});
