import { z } from 'zod';
import { formatBrl } from '../../verify/format.brl.ts';
import { defineOperation } from './operation.adapter.ts';
import { choiceLabel, accountLabel, categoryLabel, ensureCategory, resolveCategory } from './operation.lookups.ts';
import { dateLine, moneyLine } from './money.line.ts';

const input = z.object({
  date: z.iso.date(),
  amountCents: z.int().positive(),
  source: z.string().min(1).max(120).describe('origem do ganho, ex.: Salario'),
  accountId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().min(1).optional(),
  notes: z.string().max(120).optional(),
});

/** Registrar um ganho avulso (sem recorrencia nesta versao). */
export const incomeCreateOperation = defineOperation({
  kind: 'income.create',
  input,
  normalize: async (i, ctx) => ({ ...i, categoryId: undefined, categoryName: undefined, ...(await resolveCategory(ctx, i)) }),
  watch: () => Promise.resolve([]),
  validate: async (i, ctx) => {
    if (i.accountId !== undefined && (await ctx.db.accounts.findById(ctx.userId, i.accountId)) === null) return { invalid: `conta ${i.accountId} nao encontrada` };
    return { flags: [] };
  },
  preview: async (i, ctx) => ({
    label: `Ganho ${formatBrl(i.amountCents)} · ${i.source}`,
    before: null,
    after: [moneyLine('Valor', i.amountCents), dateLine('Data', i.date), `Origem: ${i.source}`, ...(i.accountId ? [`Conta: ${await accountLabel(ctx, i.accountId)}`] : []), ...(i.categoryId || i.categoryName ? [`Categoria: ${await choiceLabel(ctx, i)}`] : [])],
    amountCents: i.amountCents,
  }),
  apply: async (i, ctx) => {
    const { categoryId, created } = await ensureCategory(ctx, i);
    const income = await ctx.writers.registerIncome.execute({
      userId: ctx.userId, date: i.date, amountCents: i.amountCents, source: i.source, recurrence: { frequency: 'nao-repete' },
      ...(i.accountId ? { accountId: i.accountId } : {}), ...(categoryId ? { categoryId } : {}), ...(i.notes ? { notes: i.notes } : {}),
    });
    return [...created, { entity: 'income', id: income.id }];
  },
});
