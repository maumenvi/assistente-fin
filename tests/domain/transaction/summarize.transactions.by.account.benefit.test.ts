import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTransactionsByAccountBenefit } from '../../../src/domain/transaction/summarize.transactions.by.account.benefit.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';

const account = (id: string, overrides: Partial<Parameters<typeof Account.create>[0]> = {}) =>
  Account.create({
    id,
    userId: 'u1',
    name: `Conta ${id}`,
    kind: 'checking',
    openingBalance: Money.zero(),
    ...overrides,
  });

const transaction = (
  id: string,
  type: 'income' | 'expense',
  accountId: string,
  amountCents: number,
) =>
  Transaction.create({
    id,
    userId: 'u1',
    date: new Date('2026-09-10T00:00:00.000Z'),
    amount: Money.fromCents(amountCents),
    type,
    categoryId: 'cat-1',
    accountId,
  });

test('ganhos/gastos de conta-beneficio somam em benefit, nunca em general (RF-10, RF-11)', () => {
  const accounts = [account('a1'), account('a2', { isBenefit: true })];
  const transactions = [
    transaction('t1', 'income', 'a1', 10_000),
    transaction('t2', 'income', 'a2', 3_000),
    transaction('t3', 'expense', 'a1', 4_000),
    transaction('t4', 'expense', 'a2', 1_000),
  ];

  const summary = summarizeTransactionsByAccountBenefit(transactions, accounts);

  assert.equal(summary.income.general.cents, 10_000);
  assert.equal(summary.income.benefit.cents, 3_000);
  assert.equal(summary.expense.general.cents, 4_000);
  assert.equal(summary.expense.benefit.cents, 1_000);
});

test('contas de kind diferentes marcadas isBenefit sao tratadas igual (nao restrito a meal-voucher)', () => {
  const accounts = [
    account('a1', { kind: 'savings', isBenefit: true }),
    account('a2', { kind: 'wallet', isBenefit: true }),
    account('a3', { kind: 'meal-voucher', isBenefit: true }),
  ];
  const transactions = [
    transaction('t1', 'income', 'a1', 1_000),
    transaction('t2', 'income', 'a2', 2_000),
    transaction('t3', 'income', 'a3', 3_000),
  ];

  const summary = summarizeTransactionsByAccountBenefit(transactions, accounts);

  assert.equal(summary.income.general.cents, 0);
  assert.equal(summary.income.benefit.cents, 6_000);
});

test('cartao de credito nao marcado como beneficio entra em general', () => {
  const accounts = [account('cc1', { kind: 'credit-card' })];
  const transactions = [transaction('t1', 'expense', 'cc1', 5_000)];

  const summary = summarizeTransactionsByAccountBenefit(transactions, accounts);

  assert.equal(summary.expense.general.cents, 5_000);
  assert.equal(summary.expense.benefit.cents, 0);
});

test('mes sem transacao de beneficio -> benefit zerado', () => {
  const accounts = [account('a1'), account('a2', { isBenefit: true })];
  const transactions = [transaction('t1', 'income', 'a1', 7_000)];

  const summary = summarizeTransactionsByAccountBenefit(transactions, accounts);

  assert.equal(summary.income.general.cents, 7_000);
  assert.equal(summary.income.benefit.cents, 0);
  assert.equal(summary.expense.general.cents, 0);
  assert.equal(summary.expense.benefit.cents, 0);
});

test('lista vazia devolve todos os totais zerados', () => {
  const summary = summarizeTransactionsByAccountBenefit([], []);

  assert.equal(summary.income.general.cents, 0);
  assert.equal(summary.income.benefit.cents, 0);
  assert.equal(summary.expense.general.cents, 0);
  assert.equal(summary.expense.benefit.cents, 0);
});
