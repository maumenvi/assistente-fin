import { z } from 'zod';
import { defineOperation } from './operation.adapter.ts';
import { accountLabel, categoryLabel, transactionBlockReason } from './operation.lookups.ts';
import { dateLine, moneyLine } from './money.line.ts';
import { formatBrl } from '../../verify/format.brl.ts';

const input = z.object({ id: z.string().min(1) });

/** Excluir um lancamento avulso. Sem chave de autonomia: sempre pede aprovacao. */
export const transactionDeleteOperation = defineOperation({
  kind: 'transaction.delete',
  input,
  watch: (i) => Promise.resolve([{ entity: 'transaction' as const, id: i.id }]),
  validate: async (i, ctx) => {
    const tx = await ctx.db.transactions.findById(ctx.userId, i.id);
    if (tx === null) return { invalid: `lancamento ${i.id} nao encontrado` };
    const blocked = transactionBlockReason(tx);
    return blocked === null ? { flags: [] } : { invalid: blocked };
  },
  preview: async (i, ctx) => {
    const tx = await ctx.db.transactions.findById(ctx.userId, i.id);
    if (tx === null) return { label: 'Excluir lancamento', before: null, after: ['Excluido'], amountCents: null };
    return {
      label: `Excluir ${formatBrl(tx.amount.cents)}${tx.notes ? ` · ${tx.notes}` : ''}`,
      before: [moneyLine('Valor', tx.amount.cents), dateLine('Data', tx.date.toISOString()), `Conta: ${await accountLabel(ctx, tx.accountId)}`, `Categoria: ${await categoryLabel(ctx, tx.categoryId)}`],
      after: ['Excluido'],
      amountCents: tx.amount.cents,
    };
  },
  apply: async (i, ctx) => {
    await ctx.writers.deleteTransaction.execute({ userId: ctx.userId, id: i.id });
    return [];
  },
});
