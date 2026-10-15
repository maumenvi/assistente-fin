import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateTransferUseCase } from '../../../src/app/transaction/create.transfer.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { CreditCardNotAllowedInTransferError } from '../../../src/domain/transaction/credit.card.not.allowed.in.transfer.error.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const makeUseCase = async (options: { verified?: boolean } = {}) => {
  const { verified = true } = options;
  const database = new FakeDatabase();

  let user = User.create({
    id: 'u1',
    cpf: Cpf.create('52998224725'),
    email: Email.create('marco@exemplo.com'),
    phone: Phone.create('11987654321'),
    name: 'Marco',
    createdAt: NOW,
  });
  if (verified) {
    user = user.verifyEmail(NOW).verifyPhone(NOW);
  }
  await database.users.save(user);

  await database.accounts.save(
    Account.create({ id: 'acc-itau', userId: 'u1', name: 'Itau', kind: 'checking', openingBalance: Money.zero() }),
  );
  await database.accounts.save(
    Account.create({
      id: 'acc-mp',
      userId: 'u1',
      name: 'Mercado Pago',
      kind: 'wallet',
      openingBalance: Money.zero(),
    }),
  );
  await database.accounts.save(
    Account.create({
      id: 'acc-cartao',
      userId: 'u1',
      name: 'Cartao',
      kind: 'credit-card',
      openingBalance: Money.zero(),
    }),
  );

  const useCase = new CreateTransferUseCase(database, new SequentialIdGenerator('id'));
  return { database, transactions: database.transactions, categories: database.categories, useCase };
};

const baseInput = () => ({
  userId: 'u1',
  fromAccountId: 'acc-itau',
  toAccountId: 'acc-mp',
  amountCents: 60_000,
  date: '2026-01-05T00:00:00.000Z',
});

test('cria as duas pontas com mesmo valor/data/categoria e transferGroupId (spec 016, RF-3)', async () => {
  const { transactions, categories, useCase } = await makeUseCase();

  const result = await useCase.execute(baseInput());

  assert.equal(result.outgoing.type, 'expense');
  assert.equal(result.outgoing.accountId, 'acc-itau');
  assert.equal(result.incoming.type, 'income');
  assert.equal(result.incoming.accountId, 'acc-mp');
  assert.equal(result.outgoing.amount.cents, 60_000);
  assert.equal(result.incoming.amount.cents, 60_000);
  assert.equal(result.outgoing.date.toISOString(), result.incoming.date.toISOString());
  assert.equal(result.outgoing.categoryId, result.incoming.categoryId);
  assert.ok(result.outgoing.transferGroupId);
  assert.equal(result.outgoing.transferGroupId, result.incoming.transferGroupId);

  const category = await categories.findById('u1', result.outgoing.categoryId);
  assert.equal(category?.isSystemTransfer, true);
  assert.equal(category?.name.value, 'TRANSFERÊNCIAS');

  assert.equal((await transactions.listByUser('u1')).length, 2);
});

test('rejeita fromAccountId igual a toAccountId', async () => {
  const { transactions, useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...baseInput(), toAccountId: 'acc-itau' }),
    InvalidInputError,
  );
  assert.equal((await transactions.listByUser('u1')).length, 0);
});

test('rejeita cartao de credito como conta de origem (spec 016, RF-4)', async () => {
  const { transactions, useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...baseInput(), fromAccountId: 'acc-cartao' }),
    CreditCardNotAllowedInTransferError,
  );
  assert.equal((await transactions.listByUser('u1')).length, 0);
});

test('rejeita cartao de credito como conta de destino (spec 016, RF-4)', async () => {
  const { transactions, useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...baseInput(), toAccountId: 'acc-cartao' }),
    CreditCardNotAllowedInTransferError,
  );
  assert.equal((await transactions.listByUser('u1')).length, 0);
});

test('conta de origem inexistente vira AccountNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...baseInput(), fromAccountId: 'inexistente' }),
    AccountNotFoundError,
  );
});

test('conta de destino inexistente vira AccountNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...baseInput(), toAccountId: 'inexistente' }),
    AccountNotFoundError,
  );
});

test('duas transferencias seguidas reusam a mesma categoria de sistema (idempotente)', async () => {
  const { useCase } = await makeUseCase();

  const first = await useCase.execute(baseInput());
  const second = await useCase.execute({ ...baseInput(), amountCents: 1_000 });

  assert.equal(first.outgoing.categoryId, second.outgoing.categoryId);
  assert.notEqual(first.outgoing.transferGroupId, second.outgoing.transferGroupId);
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...baseInput(), userId: 'inexistente' }),
    UserNotFoundError,
  );
});

test('usuario nao verificado vira UserNotVerifiedError', async () => {
  const { useCase } = await makeUseCase({ verified: false });

  await assert.rejects(useCase.execute(baseInput()), UserNotVerifiedError);
});

test('entrada invalida vira InvalidInputError com erros por campo', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: '', fromAccountId: '', toAccountId: '', amountCents: -1 }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.ok(error.fieldErrors['userId']);
      assert.ok(error.fieldErrors['fromAccountId']);
      assert.ok(error.fieldErrors['toAccountId']);
      assert.ok(error.fieldErrors['amountCents']);
      return true;
    },
  );
});
