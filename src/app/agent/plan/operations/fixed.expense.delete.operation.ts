import { z } from 'zod';
import { formatBrl } from '../../verify/format.brl.ts';
import { defineOperation } from './operation.adapter.ts';
import { moneyLine } from './money.line.ts';

const input = z.object({ id: z.string().min(1) });

/** Excluir um gasto fixo (e o lancamento do mes ligado a ele, como na tela). Sempre pede aprovacao. */
export const fixedExpenseDeleteOperation = defineOperation({
  kind: 'fixedExpense.delete',
  input,
  watch: async (i, ctx) => {
    const linked = await ctx.db.transactions.findByFixedExpenseId(ctx.userId, i.id);
    return [{ entity: 'fixedExpense' as const, id: i.id }, ...(linked ? [{ entity: 'transaction' as const, id: linked.id }] : [])];
  },
  validate: async (i, ctx) => ((await ctx.db.fixedExpenses.findById(ctx.userId, i.id)) === null ? { invalid: `gasto fixo ${i.id} nao encontrado` } : { flags: [] }),
  preview: async (i, ctx) => {
    const fixed = await ctx.db.fixedExpenses.findById(ctx.userId, i.id);
    if (fixed === null) return { label: 'Excluir gasto fixo', before: null, after: ['Excluido'], amountCents: null };
    return { label: `Excluir gasto fixo ${formatBrl(fixed.expectedAmount.cents)}${fixed.description ? ` · ${fixed.description}` : ''}`, before: [moneyLine('Valor esperado', fixed.expectedAmount.cents), `Vence dia ${fixed.dueDay}`], after: ['Excluido'], amountCents: fixed.expectedAmount.cents };
  },
  apply: async (i, ctx) => {
    await ctx.writers.deleteFixedExpense.execute({ userId: ctx.userId, id: i.id });
    return [];
  },
});
