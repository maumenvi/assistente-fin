import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnsurePreviousMonthBalanceTransactionUseCase } from '../../../src/app/dashboard/ensure.previous.month.balance.transaction.use.case.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const setup = async (options: { verified?: boolean; defaultAccount?: boolean } = {}) => {
  const { verified = true, defaultAccount = true } = options;
  const database = new FakeDatabase();

  let user = User.create({
    id: 'u1',
    cpf: Cpf.create('52998224725'),
    email: Email.create('marco@exemplo.com'),
    phone: Phone.create('11987654321'),
    name: 'Marco',
    createdAt: NOW,
  });
  if (verified) user = user.verifyEmail(NOW).verifyPhone(NOW);
  if (defaultAccount) user = user.setDefaultAccount('acc1');
  await database.users.save(user);

  await database.accounts.save(
    Account.create({
      id: 'acc1',
      userId: 'u1',
      name: 'Carteira',
      kind: 'checking',
      openingBalance: Money.zero(),
    }),
  );

  const useCase = new EnsurePreviousMonthBalanceTransactionUseCase(database, new SequentialIdGenerator('tx'));
  return { database, useCase };
};

const income = (id: string, date: string, cents: number, accountId = 'acc1') =>
  Transaction.create({
    id,
    userId: 'u1',
    date: new Date(date),
    amount: Money.fromCents(cents),
    type: 'income',
    categoryId: 'cat-1',
    accountId,
  });

const expense = (id: string, date: string, cents: number, accountId = 'acc1') =>
  Transaction.create({
    id,
    userId: 'u1',
    date: new Date(date),
    amount: Money.fromCents(cents),
    type: 'expense',
    categoryId: 'cat-1',
    accountId,
  });

test('mes nunca gerado: cria a transacao de saldo e marca BalanceGeneration, valor correto (RF-16)', async () => {
  const { database, useCase } = await setup();
  await database.transactions.save(income('t1', '2026-08-10T00:00:00.000Z', 50_000));
  await database.transactions.save(expense('t2', '2026-08-15T00:00:00.000Z', 20_000));

  const result = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 9 } });

  assert.equal(result.created, true);
  assert.ok(result.transactionId);
  const created = await database.transactions.findById('u1', result.transactionId!);
  assert.equal(created?.type, 'income');
  assert.equal(created?.amount.cents, 30_000);
  assert.equal(created?.date.toISOString(), '2026-09-01T00:00:00.000Z');
  const category = await database.categories.findById('u1', created!.categoryId);
  assert.equal(category?.isSystemBalance, true);
  assert.equal(await database.balanceGenerations.existsFor('u1', 2026, 9), true);
});

test('mes ja gerado com transacao existente: nao cria de novo', async () => {
  const { database, useCase } = await setup();
  await database.transactions.save(income('t1', '2026-08-10T00:00:00.000Z', 50_000));

  const first = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 9 } });
  assert.equal(first.created, true);

  const second = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 9 } });
  assert.equal(second.created, false);
  assert.equal(second.transactionId, null);
  assert.equal((await database.transactions.listByUser('u1')).length, 2, 'so a original + a gerada');
});

test('mes ja gerado mas a transacao foi excluida pelo usuario: nao recria (RF-17, decisao 4.9)', async () => {
  const { database, useCase } = await setup();
  await database.transactions.save(income('t1', '2026-08-10T00:00:00.000Z', 50_000));

  const first = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 9 } });
  assert.equal(first.created, true);
  await database.transactions.delete('u1', first.transactionId!);

  const second = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 9 } });
  assert.equal(second.created, false);
  assert.equal(second.transactionId, null);
  const remaining = await database.transactions.listByUser('u1');
  assert.equal(remaining.length, 1, 'so a transacao original de agosto, sem a de saldo recriada');
  assert.equal(remaining[0]!.id, 't1');
});

test('saldo negativo do mes anterior vira expense de valor absoluto (decisao 4.9)', async () => {
  const { database, useCase } = await setup();
  await database.transactions.save(income('t1', '2026-08-10T00:00:00.000Z', 10_000));
  await database.transactions.save(expense('t2', '2026-08-15T00:00:00.000Z', 30_000));

  const result = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 9 } });

  assert.equal(result.created, true);
  const created = await database.transactions.findById('u1', result.transactionId!);
  assert.equal(created?.type, 'expense');
  assert.equal(created?.amount.cents, 20_000);
});

test('saldo zero do mes anterior nao gera lancamento, mas marca a geracao', async () => {
  const { database, useCase } = await setup();
  await database.transactions.save(income('t1', '2026-08-10T00:00:00.000Z', 10_000));
  await database.transactions.save(expense('t2', '2026-08-15T00:00:00.000Z', 10_000));

  const result = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 9 } });

  assert.equal(result.created, false);
  assert.equal(result.transactionId, null);
  assert.equal(await database.balanceGenerations.existsFor('u1', 2026, 9), true);
});

test('ganhos/gastos de conta-beneficio no mes anterior sao excluidos do calculo (RF-10, RF-11)', async () => {
  const { database, useCase } = await setup();
  await database.accounts.save(
    Account.create({
      id: 'acc-benefit',
      userId: 'u1',
      name: 'Vale',
      kind: 'meal-voucher',
      openingBalance: Money.zero(),
      isBenefit: true,
    }),
  );
  await database.transactions.save(income('t1', '2026-08-10T00:00:00.000Z', 10_000));
  await database.transactions.save(income('t2', '2026-08-11T00:00:00.000Z', 5_000, 'acc-benefit'));

  const result = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 9 } });

  const created = await database.transactions.findById('u1', result.transactionId!);
  assert.equal(created?.amount.cents, 10_000, 'beneficio nao entra na soma');
});

test('sem conta padrao configurada, nao gera lancamento mas marca a geracao', async () => {
  const { database, useCase } = await setup({ defaultAccount: false });
  await database.transactions.save(income('t1', '2026-08-10T00:00:00.000Z', 50_000));

  const result = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 9 } });

  assert.equal(result.created, false);
  assert.equal(result.transactionId, null);
  assert.equal(await database.balanceGenerations.existsFor('u1', 2026, 9), true);
  assert.equal((await database.transactions.listByUser('u1')).length, 1, 'nenhuma nova transacao');
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await setup();

  await assert.rejects(
    useCase.execute({ userId: 'inexistente', month: { year: 2026, month: 9 } }),
    UserNotFoundError,
  );
});

test('usuario nao verificado vira UserNotVerifiedError', async () => {
  const { useCase } = await setup({ verified: false });

  await assert.rejects(
    useCase.execute({ userId: 'u1', month: { year: 2026, month: 9 } }),
    UserNotVerifiedError,
  );
});

test('isola por usuario: BalanceGeneration de um usuario nao afeta outro', async () => {
  const { database, useCase } = await setup();
  let other = User.create({
    id: 'u2',
    cpf: Cpf.create('11144477735'),
    email: Email.create('outro@exemplo.com'),
    phone: Phone.create('11987654322'),
    name: 'Outro',
    createdAt: NOW,
  });
  other = other.verifyEmail(NOW).verifyPhone(NOW).setDefaultAccount('acc2');
  await database.users.save(other);
  await database.accounts.save(
    Account.create({
      id: 'acc2',
      userId: 'u2',
      name: 'Carteira 2',
      kind: 'checking',
      openingBalance: Money.zero(),
    }),
  );

  await useCase.execute({ userId: 'u1', month: { year: 2026, month: 9 } });

  assert.equal(await database.balanceGenerations.existsFor('u2', 2026, 9), false);
});
