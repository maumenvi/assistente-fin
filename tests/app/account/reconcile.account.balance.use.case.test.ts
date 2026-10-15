import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReconcileAccountBalanceUseCase } from '../../../src/app/account/reconcile.account.balance.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const makeUseCase = async (options: { openingBalanceCents?: number; openingBalanceDate?: Date | null } = {}) => {
  const { openingBalanceCents = 0, openingBalanceDate = null } = options;
  const database = new FakeDatabase();
  const account = Account.create({
    id: 'a1',
    userId: 'u1',
    name: 'Itau',
    kind: 'checking',
    openingBalance: Money.fromCents(openingBalanceCents),
    openingBalanceDate,
  });
  await database.accounts.save(account);
  return {
    transactions: database.transactions,
    categories: database.categories,
    useCase: new ReconcileAccountBalanceUseCase(database, new SequentialIdGenerator('tx')),
  };
};

test('saldo informado igual ao calculado: idempotente, nenhum ajuste criado', async () => {
  const { transactions, useCase } = await makeUseCase();
  await transactions.save(
    Transaction.create({
      id: 'tx1',
      userId: 'u1',
      date: new Date('2026-09-05'),
      amount: Money.fromCents(50_000),
      type: 'income',
      categoryId: 'cat-1',
      accountId: 'a1',
    }),
  );

  const result = await useCase.execute({
    userId: 'u1',
    accountId: 'a1',
    expectedBalanceCents: 50_000,
    date: '2026-09-17T00:00:00.000Z',
  });

  assert.equal(result.adjustment, null);
  assert.equal(result.balanceBeforeCents, 50_000);
  assert.equal((await transactions.listByUser('u1')).length, 1, 'nenhuma transacao nova');
});

test('saldo informado maior que o calculado gera AJUSTE de despesa negativa (credita a diferenca)', async () => {
  const { transactions, categories, useCase } = await makeUseCase();
  await transactions.save(
    Transaction.create({
      id: 'tx1',
      userId: 'u1',
      date: new Date('2026-09-05'),
      amount: Money.fromCents(50_000),
      type: 'income',
      categoryId: 'cat-1',
      accountId: 'a1',
    }),
  );

  const result = await useCase.execute({
    userId: 'u1',
    accountId: 'a1',
    expectedBalanceCents: 60_000,
    date: '2026-09-17T00:00:00.000Z',
  });

  assert.ok(result.adjustment);
  assert.equal(result.adjustment!.type, 'expense');
  assert.equal(result.adjustment!.amount.cents, -10_000);

  const category = await categories.findById('u1', result.adjustment!.categoryId);
  assert.equal(category?.isSystemAdjustment, true);
});

test('saldo informado menor que o calculado gera AJUSTE de despesa positiva', async () => {
  const { transactions, useCase } = await makeUseCase();
  await transactions.save(
    Transaction.create({
      id: 'tx1',
      userId: 'u1',
      date: new Date('2026-09-05'),
      amount: Money.fromCents(50_000),
      type: 'income',
      categoryId: 'cat-1',
      accountId: 'a1',
    }),
  );

  const result = await useCase.execute({
    userId: 'u1',
    accountId: 'a1',
    expectedBalanceCents: 30_000,
    date: '2026-09-17T00:00:00.000Z',
  });

  assert.equal(result.adjustment!.amount.cents, 20_000);
  assert.equal(result.adjustment!.date.toISOString(), new Date('2026-09-17T00:00:00.000Z').toISOString());
});

test('respeita openingBalanceDate como piso - cenario do ticket: saldo atual cadastrado + historico importado do mesmo periodo', async () => {
  const { transactions, useCase } = await makeUseCase({
    openingBalanceCents: 95_756,
    openingBalanceDate: new Date('2026-09-17T00:00:00.000Z'),
  });
  await transactions.save(
    Transaction.create({
      id: 'saldo-inicial',
      userId: 'u1',
      date: new Date('2026-09-17T00:00:00.000Z'),
      amount: Money.fromCents(95_756),
      type: 'expense',
      categoryId: 'cat-sistema',
      accountId: 'a1',
    }),
  );
  // historico do periodo anterior a openingBalanceDate, ja embutido no saldo cadastrado.
  await transactions.save(
    Transaction.create({
      id: 'salario',
      userId: 'u1',
      date: new Date('2026-09-01'),
      amount: Money.fromCents(589_049),
      type: 'income',
      categoryId: 'cat-1',
      accountId: 'a1',
    }),
  );

  const result = await useCase.execute({
    userId: 'u1',
    accountId: 'a1',
    expectedBalanceCents: 95_756,
    date: '2026-09-17T00:00:00.000Z',
  });

  // sem o piso de openingBalanceDate, o calculo incluiria o salario e o saldo bateria errado;
  // com o piso, o historico anterior e ignorado e o saldo calculado bate exatamente.
  assert.equal(result.balanceBeforeCents, -95_756);
  assert.ok(result.adjustment, 'sem o piso, isso daria idempotente por acidente - aqui confirma que o calculo usou so a transacao dentro do piso');
});

test('conta inexistente ou de outro usuario vira AccountNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'inexistente', expectedBalanceCents: 0, date: '2026-01-01' }),
    AccountNotFoundError,
  );
  await assert.rejects(
    useCase.execute({ userId: 'u2', accountId: 'a1', expectedBalanceCents: 0, date: '2026-01-01' }),
    AccountNotFoundError,
  );
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'a1', expectedBalanceCents: 1.5, date: '2026-01-01' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'reconciliar saldo da conta');
      return true;
    },
  );
});

test('dryRun: true nao persiste nada, mas devolve o resultado completo (spec 016, RF-17)', async () => {
  const { transactions, useCase } = await makeUseCase();
  await transactions.save(
    Transaction.create({
      id: 'tx1',
      userId: 'u1',
      date: new Date('2026-09-05'),
      amount: Money.fromCents(50_000),
      type: 'income',
      categoryId: 'cat-1',
      accountId: 'a1',
    }),
  );

  const result = await useCase.execute({
    userId: 'u1',
    accountId: 'a1',
    expectedBalanceCents: 60_000,
    date: '2026-09-17T00:00:00.000Z',
    dryRun: true,
  });

  assert.equal(result.adjustment, null, 'dryRun nunca cria a Transaction de ajuste');
  assert.equal(result.balanceBeforeCents, 50_000);
  assert.equal(result.expectedBalanceCents, 60_000);
  assert.equal(result.deltaCents, -10_000);
  assert.equal(result.consideredTransactionCount, 1);
  assert.equal(result.wouldCreateAdjustment, true, 'sinaliza que um dryRun:false teria criado algo');
  assert.equal((await transactions.listByUser('u1')).length, 1, 'nada novo foi persistido');
});

test('dryRun: true com saldo ja batendo -> wouldCreateAdjustment false', async () => {
  const { transactions, useCase } = await makeUseCase();
  await transactions.save(
    Transaction.create({
      id: 'tx1',
      userId: 'u1',
      date: new Date('2026-09-05'),
      amount: Money.fromCents(50_000),
      type: 'income',
      categoryId: 'cat-1',
      accountId: 'a1',
    }),
  );

  const result = await useCase.execute({
    userId: 'u1',
    accountId: 'a1',
    expectedBalanceCents: 50_000,
    date: '2026-09-17T00:00:00.000Z',
    dryRun: true,
  });

  assert.equal(result.wouldCreateAdjustment, false);
  assert.equal(result.deltaCents, 0);
});

test('dryRun omitido/false preserva 100% o comportamento atual (grava o ajuste)', async () => {
  const { transactions, useCase } = await makeUseCase();
  await transactions.save(
    Transaction.create({
      id: 'tx1',
      userId: 'u1',
      date: new Date('2026-09-05'),
      amount: Money.fromCents(50_000),
      type: 'income',
      categoryId: 'cat-1',
      accountId: 'a1',
    }),
  );

  const withoutDryRun = await useCase.execute({
    userId: 'u1',
    accountId: 'a1',
    expectedBalanceCents: 60_000,
    date: '2026-09-17T00:00:00.000Z',
  });
  assert.ok(withoutDryRun.adjustment);
  assert.equal((await transactions.listByUser('u1')).length, 2);

  const withDryRunFalse = await useCase.execute({
    userId: 'u1',
    accountId: 'a1',
    expectedBalanceCents: 60_000,
    date: '2026-09-17T00:00:00.000Z',
    dryRun: false,
  });
  // ja bate (o ajuste anterior corrigiu) - idempotente, nenhuma nova
  assert.equal(withDryRunFalse.adjustment, null);
  assert.equal((await transactions.listByUser('u1')).length, 2);
});
