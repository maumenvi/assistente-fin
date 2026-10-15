import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ListSpendingLimitsWithUsageUseCase } from '../../../src/app/spending-limit/list.spending.limits.with.usage.use.case.ts';
import { SpendingLimit } from '../../../src/domain/spending-limit/spending.limit.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';
import { FakeSpendingLimitRepository } from '../../../src/database/fake/spending.limit.repository.fake.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';
import { FakeAccountRepository } from '../../../src/database/fake/account.repository.fake.ts';

const limit = (id: string, categoryId: string, maxCents: number) =>
  SpendingLimit.create({
    id,
    userId: 'u1',
    categoryId,
    period: Month.create({ year: 2026, month: 3 }),
    maxAmount: Money.fromCents(maxCents),
  });

const expense = (id: string, categoryId: string, cents: number, isoDate: string, accountId = 'a1') =>
  Transaction.create({
    id,
    userId: 'u1',
    date: new Date(isoDate),
    amount: Money.fromCents(cents),
    type: 'expense',
    categoryId,
    accountId,
  });

const setup = async () => {
  const limits = new FakeSpendingLimitRepository();
  const transactions = new FakeTransactionRepository();
  const accounts = new FakeAccountRepository();
  await accounts.save(
    Account.create({ id: 'a1', userId: 'u1', name: 'Conta', kind: 'checking', openingBalance: Money.zero() }),
  );
  return {
    limits,
    transactions,
    accounts,
    useCase: new ListSpendingLimitsWithUsageUseCase(limits, transactions, accounts),
  };
};

test('soma so os gastos da categoria e mes do limite; deriva o status (CA-4)', async () => {
  const { limits, transactions, useCase } = await setup();
  await limits.save(limit('L-merc', 'mercado', 50_000));
  await limits.save(limit('L-lazer', 'lazer', 30_000));

  await transactions.save(expense('t1', 'mercado', 20_000, '2026-03-05'));
  await transactions.save(expense('t2', 'mercado', 45_000, '2026-03-20')); // total 65k > 50k
  await transactions.save(expense('t3', 'mercado', 99_000, '2026-02-10')); // outro mes: ignora
  await transactions.save(expense('t4', 'lazer', 10_000, '2026-03-08')); // 10k de 30k -> ok

  const result = await useCase.execute({ userId: 'u1' });
  const merc = result.find((r) => r.limit.id === 'L-merc')!;
  const lazer = result.find((r) => r.limit.id === 'L-lazer')!;

  assert.equal(merc.spent.cents, 65_000);
  assert.equal(merc.status, 'exceeded');
  assert.equal(lazer.spent.cents, 10_000);
  assert.equal(lazer.status, 'ok');
});

test('status at-risk a 80% do limite', async () => {
  const { limits, transactions, useCase } = await setup();
  await limits.save(limit('L', 'mercado', 100_000));
  await transactions.save(expense('t1', 'mercado', 85_000, '2026-03-05'));

  const [row] = await useCase.execute({ userId: 'u1' });
  assert.equal(row?.status, 'at-risk');
});

test('gastos type:income na mesma categoria nao contam', async () => {
  const { limits, transactions, useCase } = await setup();
  await limits.save(limit('L', 'mercado', 50_000));
  await transactions.save(
    Transaction.create({
      id: 'i1',
      userId: 'u1',
      date: new Date('2026-03-05'),
      amount: Money.fromCents(90_000),
      type: 'income',
      categoryId: 'mercado',
      accountId: 'a1',
    }),
  );

  const [row] = await useCase.execute({ userId: 'u1' });
  assert.equal(row?.spent.cents, 0);
  assert.equal(row?.status, 'ok');
});

test('gasto em conta-beneficio nao entra no usado de nenhum limite (spec 011, RF-11)', async () => {
  const { limits, transactions, accounts, useCase } = await setup();
  await accounts.save(
    Account.create({
      id: 'benefit-acc',
      userId: 'u1',
      name: 'Vale',
      kind: 'meal-voucher',
      openingBalance: Money.zero(),
      isBenefit: true,
    }),
  );
  await limits.save(limit('L', 'mercado', 50_000));
  await transactions.save(expense('t1', 'mercado', 20_000, '2026-03-05', 'a1'));
  await transactions.save(expense('t2', 'mercado', 15_000, '2026-03-06', 'benefit-acc'));

  const [row] = await useCase.execute({ userId: 'u1' });

  assert.equal(row?.spent.cents, 20_000, 'gasto em conta-beneficio excluido do usado');
});
