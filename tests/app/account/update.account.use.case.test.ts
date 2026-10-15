import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UpdateAccountUseCase } from '../../../src/app/account/update.account.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const seedVerifiedUser = async (database: FakeDatabase) => {
  const user = User.create({
    id: 'u1',
    cpf: Cpf.create('52998224725'),
    email: Email.create('marco@exemplo.com'),
    phone: Phone.create('11987654321'),
    name: 'Marco',
    createdAt: NOW,
  }).verifyEmail(NOW).verifyPhone(NOW);
  await database.users.save(user);
};

const makeUseCase = async (options: { openingBalanceCents?: number } = {}) => {
  const { openingBalanceCents = 10_000 } = options;
  const database = new FakeDatabase();
  await seedVerifiedUser(database);
  const account = Account.create({
    id: 'a1',
    userId: 'u1',
    name: 'Carteira',
    kind: 'checking',
    openingBalance: Money.fromCents(openingBalanceCents),
    openingBalanceDate: openingBalanceCents !== 0 ? new Date('2026-01-01T00:00:00.000Z') : null,
  });
  await database.accounts.save(account);
  return {
    accounts: database.accounts,
    transactions: database.transactions,
    categories: database.categories,
    useCase: new UpdateAccountUseCase(database, new SequentialIdGenerator('tx')),
  };
};

test('atualiza nome e arquivamento (RF-1)', async () => {
  const { accounts, useCase } = await makeUseCase();

  const updated = await useCase.execute({
    id: 'a1',
    userId: 'u1',
    name: 'Nubank',
    archived: true,
  });

  assert.equal(updated.name, 'Nubank');
  assert.equal(updated.archived, true);
  assert.equal((await accounts.findById('u1', 'a1'))?.name, 'Nubank');
});

test('so aplica os campos presentes na entrada', async () => {
  const { useCase } = await makeUseCase();

  const updated = await useCase.execute({ id: 'a1', userId: 'u1', archived: true });

  assert.equal(updated.name, 'Carteira');
  assert.equal(updated.openingBalance.cents, 10_000);
  assert.equal(updated.archived, true);
});

test('kind troca entre tipos comuns (RF-1)', async () => {
  const { accounts, useCase } = await makeUseCase();

  const updated = await useCase.execute({ id: 'a1', userId: 'u1', kind: 'savings' });

  assert.equal(updated.kind, 'savings');
  assert.equal((await accounts.findById('u1', 'a1'))?.kind, 'savings');
});

test('kind rejeita de/para credit-card', async () => {
  const database = new FakeDatabase();
  await seedVerifiedUser(database);
  const account = Account.create({
    id: 'a1',
    userId: 'u1',
    name: 'Cartao',
    kind: 'credit-card',
    openingBalance: Money.zero(),
  });
  await database.accounts.save(account);
  const useCase = new UpdateAccountUseCase(database, new SequentialIdGenerator('tx'));

  await assert.rejects(useCase.execute({ id: 'a1', userId: 'u1', kind: 'checking' }));

  const { useCase: commonUseCase } = await makeUseCase();
  await assert.rejects(commonUseCase.execute({ id: 'a1', userId: 'u1', kind: 'credit-card' }));
});

test('editar openingBalanceCents e permitido antes de a conta ter movimentacao real', async () => {
  const { useCase } = await makeUseCase();

  const updated = await useCase.execute({
    id: 'a1',
    userId: 'u1',
    openingBalanceCents: 5_000,
    openingBalanceDate: '2026-02-01T00:00:00.000Z',
  });

  assert.equal(updated.openingBalance.cents, 5_000);
  assert.equal(updated.openingBalanceDate?.toISOString(), new Date('2026-02-01T00:00:00.000Z').toISOString());
});

test('editar openingBalanceCents depois que a conta ja tem uma transacao real vira InvalidInputError - use reconciliacao', async () => {
  const { transactions, useCase } = await makeUseCase();
  await transactions.save(
    Transaction.create({
      id: 'tx-real',
      userId: 'u1',
      date: new Date('2026-01-05'),
      amount: Money.fromCents(3_000),
      type: 'expense',
      categoryId: 'cat-1',
      accountId: 'a1',
    }),
  );

  await assert.rejects(
    useCase.execute({ id: 'a1', userId: 'u1', openingBalanceCents: 7_000 }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'atualizar conta');
      return true;
    },
  );
});

test('editar openingBalanceCents e permitido se a unica transacao existente for a propria "SALDO INICIAL" gerada pelo sistema', async () => {
  const { transactions, categories, useCase } = await makeUseCase();
  const openingBalanceCategory = await categories.findSystemOpeningBalance('u1');
  const categoryId =
    openingBalanceCategory?.id ??
    (await (async () => {
      const { Category } = await import('../../../src/domain/category/category.entity.ts');
      const { CategoryName } = await import('../../../src/domain/category/category.name.value.object.ts');
      const created = Category.create({
        id: 'cat-saldo-inicial',
        userId: 'u1',
        name: CategoryName.create('SALDO INICIAL'),
        isSystemOpeningBalance: true,
      });
      await categories.save(created);
      return created.id;
    })());
  await transactions.save(
    Transaction.create({
      id: 'tx-saldo-inicial',
      userId: 'u1',
      date: new Date('2026-01-01'),
      amount: Money.fromCents(10_000),
      type: 'expense',
      categoryId,
      accountId: 'a1',
    }),
  );

  const updated = await useCase.execute({
    id: 'a1',
    userId: 'u1',
    openingBalanceCents: 6_000,
    openingBalanceDate: '2026-01-15T00:00:00.000Z',
  });

  assert.equal(updated.openingBalance.cents, 6_000);
});

test('editar openingBalanceCents atualiza a Transaction "SALDO INICIAL" existente na mesma transacao de banco (spec 018, RF-28)', async () => {
  const database = new FakeDatabase();
  await seedVerifiedUser(database);
  const category = Category.create({
    id: 'cat-saldo-inicial',
    userId: 'u1',
    name: CategoryName.create('SALDO INICIAL'),
    isSystemOpeningBalance: true,
  });
  await database.categories.save(category);
  const account = Account.create({
    id: 'a1',
    userId: 'u1',
    name: 'Carteira',
    kind: 'checking',
    openingBalance: Money.fromCents(20_000),
    openingBalanceDate: new Date('2026-01-01T00:00:00.000Z'),
  });
  await database.accounts.save(account);
  await database.transactions.save(
    Transaction.create({
      id: 'tx-saldo-inicial',
      userId: 'u1',
      date: new Date('2026-01-01T00:00:00.000Z'),
      amount: Money.fromCents(20_000),
      type: 'income',
      categoryId: category.id,
      accountId: 'a1',
      notes: 'Saldo inicial',
    }),
  );
  const useCase = new UpdateAccountUseCase(database, new SequentialIdGenerator('tx'));

  await useCase.execute({
    id: 'a1',
    userId: 'u1',
    openingBalanceCents: 249_788, // R$ 2.497,88 em centavos, mesmo caso real do card
    openingBalanceDate: '2026-01-01T00:00:00.000Z',
  });

  const synced = await database.transactions.findOpeningBalanceTransaction('u1', 'a1', category.id);
  assert.equal(synced?.id, 'tx-saldo-inicial', 'preserva o id da Transaction existente');
  assert.equal(synced?.amount.cents, 249_788);
  const refreshedAccount = await database.accounts.findById('u1', 'a1');
  assert.equal(refreshedAccount?.openingBalance.cents, synced?.amount.cents, 'as duas fontes nunca divergem');
});

test('editar openingBalanceDate atualiza a data da Transaction "SALDO INICIAL" existente (spec 018, RF-28)', async () => {
  const database = new FakeDatabase();
  await seedVerifiedUser(database);
  const category = Category.create({
    id: 'cat-saldo-inicial',
    userId: 'u1',
    name: CategoryName.create('SALDO INICIAL'),
    isSystemOpeningBalance: true,
  });
  await database.categories.save(category);
  const account = Account.create({
    id: 'a1',
    userId: 'u1',
    name: 'Carteira',
    kind: 'checking',
    openingBalance: Money.fromCents(10_000),
    openingBalanceDate: new Date('2026-01-01T00:00:00.000Z'),
  });
  await database.accounts.save(account);
  await database.transactions.save(
    Transaction.create({
      id: 'tx-saldo-inicial',
      userId: 'u1',
      date: new Date('2026-01-01T00:00:00.000Z'),
      amount: Money.fromCents(10_000),
      type: 'income',
      categoryId: category.id,
      accountId: 'a1',
    }),
  );
  const useCase = new UpdateAccountUseCase(database, new SequentialIdGenerator('tx'));

  await useCase.execute({ id: 'a1', userId: 'u1', openingBalanceDate: '2026-01-17T00:00:00.000Z' });

  const synced = await database.transactions.findOpeningBalanceTransaction('u1', 'a1', category.id);
  assert.equal(synced?.date.toISOString(), new Date('2026-01-17T00:00:00.000Z').toISOString());
});

test('editar openingBalanceCents de conta que nunca teve saldo inicial (0 -> positivo) cria a Transaction agora (spec 018, RF-28)', async () => {
  const { accounts, transactions, categories, useCase } = await makeUseCase({ openingBalanceCents: 0 });

  const updated = await useCase.execute({
    id: 'a1',
    userId: 'u1',
    openingBalanceCents: 15_000,
    openingBalanceDate: '2026-01-10T00:00:00.000Z',
  });

  assert.equal(updated.openingBalance.cents, 15_000);
  const category = await categories.findSystemOpeningBalance('u1');
  assert.ok(category, 'categoria "SALDO INICIAL" deveria ter sido criada');
  const synced = await transactions.findOpeningBalanceTransaction('u1', 'a1', category.id);
  assert.ok(synced, 'Transaction "SALDO INICIAL" deveria ter sido criada agora');
  assert.equal(synced?.amount.cents, 15_000);
  assert.equal(synced?.type, 'income');
  const refreshedAccount = await accounts.findById('u1', 'a1');
  assert.equal(refreshedAccount?.openingBalance.cents, synced?.amount.cents);
});

test('conta inexistente ou de outro usuario vira AccountNotFoundError (CA-14)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ id: 'inexistente', userId: 'u1', name: 'X' }),
    AccountNotFoundError,
  );
  await assert.rejects(
    useCase.execute({ id: 'a1', userId: 'u2', name: 'X' }),
    AccountNotFoundError,
  );
});

test('update com expectedUpdatedAt desatualizado vira StaleDataError (RF-31)', async () => {
  const { accounts, useCase } = await makeUseCase();
  const seen = (await accounts.findById('u1', 'a1'))!;
  const seenAt = seen.updatedAt!.toISOString();

  await useCase.execute({ id: 'a1', userId: 'u1', name: 'Primeiro', expectedUpdatedAt: seenAt });

  await assert.rejects(
    useCase.execute({ id: 'a1', userId: 'u1', name: 'Segundo', expectedUpdatedAt: seenAt }),
    StaleDataError,
  );
  assert.equal((await accounts.findById('u1', 'a1'))?.name, 'Primeiro', 'nada gravado no 2o');
});

test('atualiza creditLimitCents/closingDay/dueDay de uma conta credit-card (spec 008 revisao, RF-1, RF-2)', async () => {
  const database = new FakeDatabase();
  const account = Account.create({
    id: 'a1',
    userId: 'u1',
    name: 'Cartao',
    kind: 'credit-card',
    openingBalance: Money.zero(),
  });
  await database.accounts.save(account);
  const useCase = new UpdateAccountUseCase(database, new SequentialIdGenerator('tx'));

  const updated = await useCase.execute({
    id: 'a1',
    userId: 'u1',
    creditLimitCents: 500_000,
    closingDay: 20,
    dueDay: 10,
  });

  assert.equal(updated.creditLimit?.cents, 500_000);
  assert.equal(updated.closingDay, 20);
  assert.equal(updated.dueDay, 10);
});

test('closingDay igual a dueDay ao atualizar vira erro (spec 008 revisao)', async () => {
  const database = new FakeDatabase();
  const account = Account.create({
    id: 'a1',
    userId: 'u1',
    name: 'Cartao',
    kind: 'credit-card',
    openingBalance: Money.zero(),
  });
  await database.accounts.save(account);
  const useCase = new UpdateAccountUseCase(database, new SequentialIdGenerator('tx'));

  await assert.rejects(
    useCase.execute({ id: 'a1', userId: 'u1', creditLimitCents: 500_000, closingDay: 10, dueDay: 10 }),
  );
});

test('creditLimitCents/closingDay/dueDay em conta de outro tipo vira erro (RF-3)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({
      id: 'a1',
      userId: 'u1',
      creditLimitCents: 500_000,
      closingDay: 20,
      dueDay: 10,
    }),
  );
});

test('atualiza isBenefit para qualquer kind de conta (spec 011, RF-9, CA-5a)', async () => {
  const { accounts, useCase } = await makeUseCase();

  const updated = await useCase.execute({ id: 'a1', userId: 'u1', isBenefit: true });
  assert.equal(updated.isBenefit, true);
  assert.equal((await accounts.findById('u1', 'a1'))?.isBenefit, true);

  const reverted = await useCase.execute({ id: 'a1', userId: 'u1', isBenefit: false });
  assert.equal(reverted.isBenefit, false);
});

test('entrada invalida vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ id: '', userId: 'u1' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'atualizar conta');
      return true;
    },
  );
});
