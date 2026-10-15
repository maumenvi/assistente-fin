import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBenefitTotalsForMonth } from '../../../src/app/forecast/resolve.benefit.totals.for.month.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';
import { FakeAccountRepository } from '../../../src/database/fake/account.repository.fake.ts';

const account = (id: string, userId: string, isBenefit = false) =>
  Account.create({
    id,
    userId,
    name: `Conta ${id}`,
    kind: 'checking',
    openingBalance: Money.zero(),
    isBenefit,
  });

const transaction = (
  id: string,
  userId: string,
  accountId: string,
  type: 'income' | 'expense',
  amountCents: number,
  date: string,
) =>
  Transaction.create({
    id,
    userId,
    date: new Date(date),
    amount: Money.fromCents(amountCents),
    type,
    categoryId: 'cat-1',
    accountId,
  });

test('orquestra a busca de transacoes/contas do mes e delega a funcao de dominio', async () => {
  const transactions = new FakeTransactionRepository();
  const accounts = new FakeAccountRepository();

  await accounts.save(account('a1', 'u1'));
  await accounts.save(account('a2', 'u1', true));
  await transactions.save(transaction('t1', 'u1', 'a1', 'income', 10_000, '2026-09-05T00:00:00.000Z'));
  await transactions.save(transaction('t2', 'u1', 'a2', 'income', 3_000, '2026-09-06T00:00:00.000Z'));
  // fora do mes-alvo: nao deve entrar na soma
  await transactions.save(transaction('t3', 'u1', 'a1', 'income', 50_000, '2026-08-01T00:00:00.000Z'));

  const summary = await resolveBenefitTotalsForMonth(
    'u1',
    Month.create({ year: 2026, month: 9 }),
    transactions,
    accounts,
  );

  assert.equal(summary.income.general.cents, 10_000);
  assert.equal(summary.income.benefit.cents, 3_000);
});

test('isola por usuario: transacoes/contas de outro usuario nao entram na soma', async () => {
  const transactions = new FakeTransactionRepository();
  const accounts = new FakeAccountRepository();

  await accounts.save(account('a1', 'u1'));
  await accounts.save(account('a2', 'u2'));
  await transactions.save(transaction('t1', 'u1', 'a1', 'income', 1_000, '2026-09-05T00:00:00.000Z'));
  await transactions.save(transaction('t2', 'u2', 'a2', 'income', 99_000, '2026-09-05T00:00:00.000Z'));

  const summary = await resolveBenefitTotalsForMonth(
    'u1',
    Month.create({ year: 2026, month: 9 }),
    transactions,
    accounts,
  );

  assert.equal(summary.income.general.cents, 1_000);
});
