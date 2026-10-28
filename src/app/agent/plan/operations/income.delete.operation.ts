import { z } from 'zod';
import { formatBrl } from '../../verify/format.brl.ts';
import { defineOperation } from './operation.adapter.ts';
import { dateLine, moneyLine } from './money.line.ts';

const input = z.object({ id: z.string().min(1) });

/** Excluir um ganho. Sem chave de autonomia: sempre pede aprovacao. */
export const incomeDeleteOperation = defineOperation({
  kind: 'income.delete',
  input,
  watch: (i) => Promise.resolve([{ entity: 'income' as const, id: i.id }]),
  validate: async (i, ctx) => ((await ctx.db.incomes.findById(ctx.userId, i.id)) === null ? { invalid: `ganho ${i.id} nao encontrado` } : { flags: [] }),
  preview: async (i, ctx) => {
    const income = await ctx.db.incomes.findById(ctx.userId, i.id);
    if (income === null) return { label: 'Excluir ganho', before: null, after: ['Excluido'], amountCents: null };
    return { label: `Excluir ganho ${formatBrl(income.amount.cents)} · ${income.source}`, before: [moneyLine('Valor', income.amount.cents), dateLine('Data', income.date.toISOString()), `Origem: ${income.source}`], after: ['Excluido'], amountCents: income.amount.cents };
  },
  apply: async (i, ctx) => {
    await ctx.writers.deleteIncome.execute({ userId: ctx.userId, id: i.id });
    return [];
  },
});
