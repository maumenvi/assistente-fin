import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortTransactions } from '../../../src/domain/transaction/sort.transactions.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';

const tx = (overrides: Partial<Parameters<typeof Transaction.create>[0]> = {}) =>
  Transaction.create({
    id: overrides.id ?? 'tx-1',
    userId: 'u1',
    date: overrides.date ?? new Date('2026-01-05T00:00:00.000Z'),
    amount: overrides.amount ?? Money.fromCents(1_000),
    type: overrides.type ?? 'expense',
    categoryId: overrides.categoryId ?? 'cat-a',
    accountId: overrides.accountId ?? 'acc-a',
    recurrence: overrides.recurrence,
    notes: overrides.notes,
    seriesId: overrides.seriesId,
  });

const rows = [
  tx({ id: 't-b', date: new Date('2026-01-10T00:00:00.000Z'), amount: Money.fromCents(3_000), type: 'income', categoryId: 'cat-b', accountId: 'acc-b', recurrence: Recurrence.create({ frequency: 'mensal', endDate: new Date('2027-01-01T00:00:00.000Z') }) }),
  tx({ id: 't-a', date: new Date('2026-01-01T00:00:00.000Z'), amount: Money.fromCents(1_000), type: 'expense', categoryId: 'cat-a', accountId: 'acc-a' }),
  tx({ id: 't-c', date: new Date('2026-01-05T00:00:00.000Z'), amount: Money.fromCents(2_000), type: 'expense', categoryId: 'cat-c', accountId: 'acc-c' }),
];

test('ordena por data crescente', () => {
  const sorted = sortTransactions(rows, 'date', 'asc');
  assert.deepEqual(sorted.map((r) => r.id), ['t-a', 't-c', 't-b']);
});

test('ordena por data decrescente', () => {
  const sorted = sortTransactions(rows, 'date', 'desc');
  assert.deepEqual(sorted.map((r) => r.id), ['t-b', 't-c', 't-a']);
});

test('ordena por valor (amount)', () => {
  const sorted = sortTransactions(rows, 'amount', 'asc');
  assert.deepEqual(sorted.map((r) => r.id), ['t-a', 't-c', 't-b']);
});

test('ordena por tipo', () => {
  const sorted = sortTransactions(rows, 'type', 'asc');
  // 'expense' < 'income' lexicograficamente
  assert.deepEqual(sorted.map((r) => r.id).slice(0, 2).sort(), ['t-a', 't-c'].sort());
  assert.equal(sorted[2]!.id, 't-b');
});

test('ordena por categoria (categoryId)', () => {
  const sorted = sortTransactions(rows, 'category', 'asc');
  assert.deepEqual(sorted.map((r) => r.id), ['t-a', 't-b', 't-c']);
});

test('ordena por conta (accountId)', () => {
  const sorted = sortTransactions(rows, 'account', 'asc');
  assert.deepEqual(sorted.map((r) => r.id), ['t-a', 't-b', 't-c']);
});

test('ordena por recorrencia (frequency)', () => {
  const sorted = sortTransactions(rows, 'recurrence', 'asc');
  // 'mensal' < 'nao-repete' lexicograficamente
  assert.equal(sorted[0]!.id, 't-b');
});

test('nao muta o array original', () => {
  const original = [...rows];
  sortTransactions(rows, 'date', 'asc');
  assert.deepEqual(rows, original);
});

test('reordenar mesma coluna so muda quando a direction muda (RF-5) - comportamento fica a cargo do chamador, funcao e pura por chamada', () => {
  const asc = sortTransactions(rows, 'amount', 'asc');
  const desc = sortTransactions(rows, 'amount', 'desc');
  assert.deepEqual(asc.map((r) => r.id), [...desc.map((r) => r.id)].reverse());
});
