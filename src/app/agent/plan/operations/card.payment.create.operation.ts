import { z } from 'zod';
import { formatBrl } from '../../verify/format.brl.ts';
import { defineOperation } from './operation.adapter.ts';
import { accountLabel } from './operation.lookups.ts';
import { dateLine, moneyLine } from './money.line.ts';

const input = z.object({
  payingAccountId: z.string().min(1),
  cardAccountId: z.string().min(1),
  amountCents: z.int().positive(),
  date: z.iso.date(),
  notes: z.string().max(500).optional(),
});

/** Pagar a fatura de um cartao (duas pernas). Sem chave de autonomia: sempre pede aprovacao. */
export const cardPaymentCreateOperation = defineOperation({
  kind: 'cardPayment.create',
  input,
  watch: () => Promise.resolve([]),
  validate: async (i, ctx) => {
    const paying = await ctx.db.accounts.findById(ctx.userId, i.payingAccountId);
    const card = await ctx.db.accounts.findById(ctx.userId, i.cardAccountId);
    if (paying === null || paying.archived) return { invalid: `conta ${i.payingAccountId} nao encontrada` };
    if (card === null || card.kind !== 'credit-card') return { invalid: `${i.cardAccountId} nao e um cartao de credito` };
    if (paying.kind === 'credit-card') return { invalid: 'a conta pagadora nao pode ser um cartao' };
    return { flags: [] };
  },
  preview: async (i, ctx) => ({
    label: `Pagar fatura ${formatBrl(i.amountCents)}`,
    before: null,
    after: [moneyLine('Valor', i.amountCents), dateLine('Data', i.date), `Paga com: ${await accountLabel(ctx, i.payingAccountId)}`, `Cartao: ${await accountLabel(ctx, i.cardAccountId)}`],
    amountCents: i.amountCents,
  }),
  apply: async (i, ctx) => {
    const { outgoing, incoming } = await ctx.writers.createCardPayment.execute({ userId: ctx.userId, ...i });
    return [{ entity: 'transaction', id: outgoing.id }, { entity: 'transaction', id: incoming.id }];
  },
});
