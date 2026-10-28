import { z } from 'zod';
import { TRANSACTION_TYPES } from '../../../../domain/transaction/transaction.type.ts';
import { formatBrl } from '../../verify/format.brl.ts';
import { defineOperation } from './operation.adapter.ts';
import { choiceLabel, accountLabel, categoryLabel, ensureCategory, resolveCategory } from './operation.lookups.ts';
import { dateLine, moneyLine } from './money.line.ts';

const input = z.object({
  date: z.iso.date().describe('data AAAA-MM-DD'),
  amountCents: z.int().positive().describe('valor em centavos'),
  type: z.enum(TRANSACTION_TYPES),
  accountId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().min(1).optional(),
  notes: z.string().max(500).optional(),
});

/** Lancar uma despesa ou receita avulsa (mesmo caminho da tela de lancamentos). */
export const transactionCreateOperation = defineOperation({
  kind: 'transaction.create',
  input,
  normalize: async (i, ctx) => ({ ...i, categoryId: undefined, categoryName: undefined, ...(await resolveCategory(ctx, i)) }),
  watch: () => Promise.resolve([]),
  validate: async (i, ctx) => {
    const account = await ctx.db.accounts.findById(ctx.userId, i.accountId);
    if (account === null || account.archived) return { invalid: `conta ${i.accountId} nao encontrada` };
    if (i.categoryId !== undefined && (await ctx.db.categories.findById(ctx.userId, i.categoryId)) === null) return { invalid: `categoria ${i.categoryId} nao encontrada` };
    return { flags: [] };
  },
  preview: async (i, ctx) => ({
    label: `${i.type === 'expense' ? 'Despesa' : 'Receita'} ${formatBrl(i.amountCents)}${i.notes ? ` · ${i.notes}` : ''}`,
    before: null,
    after: [
      moneyLine('Valor', i.amountCents),
      dateLine('Data', i.date),
      `Conta: ${await accountLabel(ctx, i.accountId)}`,
      `Categoria: ${await choiceLabel(ctx, i, 'padrao (a classificar)')}`,
      ...(i.notes ? [`Descricao: ${i.notes}`] : []),
    ],
    amountCents: i.amountCents,
  }),
  apply: async (i, ctx) => {
    const { categoryId, created } = await ensureCategory(ctx, i);
    const tx = await ctx.writers.recordTransaction.execute(
      { userId: ctx.userId, date: i.date, amountCents: i.amountCents, type: i.type, accountId: i.accountId, ...(categoryId ? { categoryId } : {}), ...(i.notes ? { notes: i.notes } : {}) },
      { allowDuplicate: true },
    );
    return [...created, { entity: 'transaction', id: tx.id }, ...(tx.incomeId ? [{ entity: 'income' as const, id: tx.incomeId }] : [])];
  },
});
