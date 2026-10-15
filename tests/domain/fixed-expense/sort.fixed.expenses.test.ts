import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortFixedExpenses } from '../../../src/domain/fixed-expense/sort.fixed.expenses.ts';
import { FixedExpense } from '../../../src/domain/fixed-expense/fixed.expense.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';

const fe = (overrides: Partial<Parameters<typeof FixedExpense.create>[0]> = {}) =>
  FixedExpense.create({
    id: overrides.id ?? 'fe-1',
    userId: 'u1',
    dueDay: overrides.dueDay ?? 10,
    referenceMonth: overrides.referenceMonth,
    description: overrides.description,
    expectedAmount: overrides.expectedAmount ?? Money.fromCents(1_000),
    categoryId: overrides.categoryId ?? 'cat-a',
    accountId: overrides.accountId ?? 'acc-a',
  });

const rows = [
  fe({ id: 'f-b', dueDay: 5, referenceMonth: 6, description: 'Netflix', expectedAmount: Money.fromCents(3_000), categoryId: 'cat-b', accountId: 'acc-b' }),
  fe({ id: 'f-a', dueDay: 20, referenceMonth: undefined, description: 'Aluguel', expectedAmount: Money.fromCents(1_000), categoryId: 'cat-a', accountId: 'acc-a' }),
  fe({ id: 'f-c', dueDay: 1, referenceMonth: 6, description: 'Agua', expectedAmount: Money.fromCents(2_000), categoryId: 'cat-c', accountId: 'acc-c' }),
];

test('ordena por descricao', () => {
  const sorted = sortFixedExpenses(rows, 'description', 'asc');
  assert.deepEqual(sorted.map((r) => r.id), ['f-c', 'f-a', 'f-b']);
});

test('ordena por categoria (categoryId)', () => {
  const sorted = sortFixedExpenses(rows, 'category', 'asc');
  assert.deepEqual(sorted.map((r) => r.id), ['f-a', 'f-b', 'f-c']);
});

test('ordena por conta (accountId)', () => {
  const sorted = sortFixedExpenses(rows, 'account', 'asc');
  assert.deepEqual(sorted.map((r) => r.id), ['f-a', 'f-b', 'f-c']);
});

test('ordena por valor (amount)', () => {
  const sorted = sortFixedExpenses(rows, 'amount', 'asc');
  assert.deepEqual(sorted.map((r) => r.id), ['f-a', 'f-c', 'f-b']);
});

test('ordena por pago (nao pago antes de pago)', () => {
  const withPaid = [
    fe({ id: 'p-paid' }).markAsPaid(),
    fe({ id: 'p-unpaid' }),
  ];
  const sorted = sortFixedExpenses(withPaid, 'paid', 'asc');
  assert.deepEqual(sorted.map((r) => r.id), ['p-unpaid', 'p-paid']);
});

test('vencimento: sem mes de referencia ordena antes de qualquer mes definido (RF-12, decisao 4.2)', () => {
  const sorted = sortFixedExpenses(rows, 'dueDate', 'asc');
  assert.equal(sorted[0]!.id, 'f-a', 'sem mes vem primeiro mesmo com dueDay maior');
  assert.deepEqual(sorted.map((r) => r.id), ['f-a', 'f-c', 'f-b']);
});

test('vencimento: mes tem precedencia sobre dia (RF-12)', () => {
  const sameMonthDiffDay = [
    fe({ id: 'm-late', dueDay: 28, referenceMonth: 2 }),
    fe({ id: 'm-early', dueDay: 1, referenceMonth: 2 }),
    fe({ id: 'm-next', dueDay: 1, referenceMonth: 3 }),
  ];
  const sorted = sortFixedExpenses(sameMonthDiffDay, 'dueDate', 'asc');
  assert.deepEqual(sorted.map((r) => r.id), ['m-early', 'm-late', 'm-next']);
});

test('toggle asc/desc inverte a ordem', () => {
  const asc = sortFixedExpenses(rows, 'amount', 'asc');
  const desc = sortFixedExpenses(rows, 'amount', 'desc');
  assert.deepEqual(asc.map((r) => r.id), [...desc.map((r) => r.id)].reverse());
});

test('nao muta o array original', () => {
  const original = [...rows];
  sortFixedExpenses(rows, 'dueDate', 'asc');
  assert.deepEqual(rows, original);
});

test('trocar de coluna e independente (funcao pura por chamada - reset para asc fica a cargo do chamador)', () => {
  const byAmount = sortFixedExpenses(rows, 'amount', 'desc');
  const byDueDate = sortFixedExpenses(rows, 'dueDate', 'asc');
  assert.notDeepEqual(byAmount.map((r) => r.id), byDueDate.map((r) => r.id));
});
