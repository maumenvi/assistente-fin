import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDashboardMonth } from '../../../src/app/dashboard/summarize.dashboard.month.ts';
import { type DashboardTransaction } from '../../../src/app/dashboard/dashboard.transaction.ts';

const base: Omit<DashboardTransaction, 'date' | 'type' | 'amountCents' | 'categoryId' | 'categoryName'> = {
  accountId: 'a1',
  isSystemCategory: false,
  isSystemTransfer: false,
  isSystemCardPayment: false,
  transferGroupId: null,
  cardPaymentGroupId: null,
  fixedExpenseId: null,
};
const tx = (over: Partial<DashboardTransaction>): DashboardTransaction => ({
  ...base,
  date: '2026-09-10T12:00:00.000Z',
  type: 'expense',
  amountCents: 1000,
  categoryId: 'c-mercado',
  categoryName: 'MERCADO',
  ...over,
});

test('resume o mes: gastos por categoria + gastos fixos, sem transferencias', () => {
  const summary = summarizeDashboardMonth(
    [
      tx({ amountCents: 14530 }),
      tx({ type: 'income', amountCents: 650000, categoryId: 'c-sal', categoryName: 'SALARIO' }),
      tx({ amountCents: 50000, transferGroupId: 'g1' }),
      tx({ amountCents: 180000, fixedExpenseId: 'fe1' }),
      tx({ date: '2026-10-01T12:00:00.000Z', amountCents: 999 }),
    ],
    [{ id: 'a1', kind: 'checking', isBenefit: false, openingBalanceDate: null }],
    [{ categoryId: 'c-aluguel', categoryName: 'ALUGUEL', expectedAmountCents: 180000 }],
    { year: 2026, month: 9 },
  );
  assert.equal(summary.totalIncomeCents, 650000);
  assert.equal(summary.totalExpenseCents, 14530 + 180000);
  assert.equal(summary.balanceCents, 650000 - 194530);
  assert.deepEqual(summary.expenseByCategory.map((row) => row.categoryId), ['c-aluguel', 'c-mercado']);
});
