import { z } from 'zod';
import { TRANSACTION_TYPES } from '../../../../domain/transaction/transaction.type.ts';
import { formatBrl } from '../../verify/format.brl.ts';
import { defineOperation } from './operation.adapter.ts';
import { choiceLabel, accountLabel, categoryLabel, ensureCategory, resolveCategory, transactionBlockReason } from './operation.lookups.ts';
import { dateLine, moneyLine } from './money.line.ts';

const input = z.object({
  id: z.string().min(1),
  date: z.iso.date().optional(),
  amountCents: z.int().positive().optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  accountId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().min(1).optional(),
  notes: z.string().max(500).optional(),
});

/** Editar um lancamento avulso (valor, data, conta, categoria, descricao). */
export const transactionUpdateOperation = defineOperation({
  kind: 'transaction.update',
  input,
  normalize: async (i, ctx) => {
    const { categoryId: _id, categoryName: _name, ...rest } = i;
    return { ...rest, ...(await resolveCategory(ctx, i)) };
  },
  watch: (i) => Promise.resolve([{ entity: 'transaction' as const, id: i.id }]),
  validate: async (i, ctx) => {
    const tx = await ctx.db.transactions.findById(ctx.userId, i.id);
    if (tx === null) return { invalid: `lancamento ${i.id} nao encontrado` };
    const blocked = transactionBlockReason(tx);
    if (blocked !== null) return { invalid: blocked };
    if (i.date === undefined && i.amountCents === undefined && i.type === undefined && i.accountId === undefined && i.categoryId === undefined && i.categoryName === undefined && i.notes === undefined) return { invalid: 'nenhuma alteracao informada' };
    if (i.accountId !== undefined && (await ctx.db.accounts.findById(ctx.userId, i.accountId)) === null) return { invalid: `conta ${i.accountId} nao encontrada` };
    return { flags: [] };
  },
  preview: async (i, ctx) => {
    const tx = await ctx.db.transactions.findById(ctx.userId, i.id);
    const before: string[] = [];
    const after: string[] = [];
    if (tx !== null) {
      if (i.amountCents !== undefined) { before.push(moneyLine('Valor', tx.amount.cents)); after.push(moneyLine('Valor', i.amountCents)); }
      if (i.date !== undefined) { before.push(dateLine('Data', tx.date.toISOString())); after.push(dateLine('Data', i.date)); }
      if (i.type !== undefined) { before.push(`Tipo: ${tx.type}`); after.push(`Tipo: ${i.type}`); }
      if (i.accountId !== undefined) { before.push(`Conta: ${await accountLabel(ctx, tx.accountId)}`); after.push(`Conta: ${await accountLabel(ctx, i.accountId)}`); }
      if (i.categoryId !== undefined || i.categoryName !== undefined) { before.push(`Categoria: ${await categoryLabel(ctx, tx.categoryId)}`); after.push(`Categoria: ${await choiceLabel(ctx, i)}`); }
      if (i.notes !== undefined) { before.push(`Descricao: ${tx.notes ?? '-'}`); after.push(`Descricao: ${i.notes}`); }
    }
    return { label: `Editar lancamento${tx?.notes ? ` · ${tx.notes}` : ''}${tx ? ` (${formatBrl(tx.amount.cents)})` : ''}`, before, after, amountCents: i.amountCents ?? tx?.amount.cents ?? null };
  },
  apply: async (i, ctx) => {
    const { categoryId, created } = await ensureCategory(ctx, i);
    const { categoryName: _name, categoryId: _id, ...rest } = i;
    await ctx.writers.updateTransaction.execute({ ...rest, userId: ctx.userId, ...(categoryId ? { categoryId } : {}) });
    return created;
  },
});
