import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listLaunchedIncomeMonths } from '../../../src/app/income/list.launched.income.months.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';

const tx = (id: string, date: string, incomeId: string | null) =>
  Transaction.create({
    id,
    userId: 'u1',
    date: new Date(date),
    amount: Money.fromCents(1_000),
    type: 'income',
    categoryId: 'cat1',
    accountId: 'acc1',
    incomeId,
  });

test('lista vazia -> Set vazio', () => {
  const result = listLaunchedIncomeMonths([], 'income-1');
  assert.equal(result.size, 0);
});

test('extrai o conjunto de meses (YYYY-MM) das transacoes com o incomeId pedido', () => {
  const transactions = [
    tx('t1', '2026-01-05T00:00:00.000Z', 'income-1'),
    tx('t2', '2026-03-05T00:00:00.000Z', 'income-1'),
  ];

  const result = listLaunchedIncomeMonths(transactions, 'income-1');
  assert.deepEqual([...result].sort(), ['2026-01', '2026-03']);
});

test('incomeId de outro Income nao entra no conjunto', () => {
  const transactions = [
    tx('t1', '2026-01-05T00:00:00.000Z', 'income-1'),
    tx('t2', '2026-02-05T00:00:00.000Z', 'income-2'),
  ];

  const result = listLaunchedIncomeMonths(transactions, 'income-1');
  assert.deepEqual([...result], ['2026-01']);
});

test('transacoes sem incomeId (avulsas) nao entram no conjunto', () => {
  const transactions = [tx('t1', '2026-01-05T00:00:00.000Z', null)];

  const result = listLaunchedIncomeMonths(transactions, 'income-1');
  assert.equal(result.size, 0);
});

test('2 transacoes no mesmo mes nao duplicam a entrada (Set)', () => {
  const transactions = [
    tx('t1', '2026-01-05T00:00:00.000Z', 'income-1'),
    tx('t2', '2026-01-20T00:00:00.000Z', 'income-1'),
  ];

  const result = listLaunchedIncomeMonths(transactions, 'income-1');
  assert.deepEqual([...result], ['2026-01']);
});
