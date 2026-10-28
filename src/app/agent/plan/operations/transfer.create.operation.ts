import { z } from 'zod';
import { formatBrl } from '../../verify/format.brl.ts';
import { defineOperation } from './operation.adapter.ts';
import { accountLabel } from './operation.lookups.ts';
import { dateLine, moneyLine } from './money.line.ts';

const input = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amountCents: z.int().positive(),
  date: z.iso.date(),
  notes: z.string().max(500).optional(),
});

/** Transferir entre duas contas de saldo (duas pernas). Sem chave de autonomia: sempre pede aprovacao. */
export const transferCreateOperation = defineOperation({
  kind: 'transfer.create',
  input,
  watch: () => Promise.resolve([]),
  validate: async (i, ctx) => {
    if (i.fromAccountId === i.toAccountId) return { invalid: 'as contas de origem e destino sao a mesma' };
    for (const id of [i.fromAccountId, i.toAccountId]) {
      const account = await ctx.db.accounts.findById(ctx.userId, id);
      if (account === null || account.archived) return { invalid: `conta ${id} nao encontrada` };
      if (account.kind === 'credit-card') return { invalid: 'transferencia nao envolve cartao de credito; use o pagamento de fatura' };
    }
    return { flags: [] };
  },
  preview: async (i, ctx) => ({
    label: `Transferir ${formatBrl(i.amountCents)}`,
    before: null,
    after: [moneyLine('Valor', i.amountCents), dateLine('Data', i.date), `De: ${await accountLabel(ctx, i.fromAccountId)}`, `Para: ${await accountLabel(ctx, i.toAccountId)}`],
    amountCents: i.amountCents,
  }),
  apply: async (i, ctx) => {
    const { outgoing, incoming } = await ctx.writers.createTransfer.execute({ userId: ctx.userId, ...i });
    return [{ entity: 'transaction', id: outgoing.id }, { entity: 'transaction', id: incoming.id }];
  },
});
