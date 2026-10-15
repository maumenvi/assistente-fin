import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateCardPaymentUseCase } from '../../../src/app/transaction/create.card.payment.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { InvalidCardPaymentAccountsError } from '../../../src/domain/transaction/invalid.card.payment.accounts.error.ts';
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
    Account.create({ id: 'acc-pri', userId: 'u1', name: 'Nubank Pri', kind: 'checking', openingBalance: Money.zero() }),
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
  await database.accounts.save(
    Account.create({
      id: 'acc-cartao2',
      userId: 'u1',
      name: 'Outro cartao',
      kind: 'credit-card',
      openingBalance: Money.zero(),
    }),
  );

  const useCase = new CreateCardPaymentUseCase(database, new SequentialIdGenerator('id'));
  return { database, transactions: database.transactions, categories: database.categories, useCase };
};

const baseInput = () => ({
  userId: 'u1',
  payingAccountId: 'acc-pri',
  cardAccountId: 'acc-cartao',
  amountCents: 249_788,
  date: '2026-01-05T00:00:00.000Z',
});

test('cria as duas pontas com mesmo valor/data/categoria e cardPaymentGroupId (spec 016, RF-6)', async () => {
  const { transactions, categories, useCase } = await makeUseCase();

  const result = await useCase.execute(baseInput());

  assert.equal(result.outgoing.type, 'expense');
  assert.equal(result.outgoing.accountId, 'acc-pri');
  assert.equal(result.incoming.type, 'income');
  assert.equal(result.incoming.accountId, 'acc-cartao');
  assert.equal(result.outgoing.amount.cents, 249_788);
  assert.equal(result.incoming.amount.cents, 249_788);
  assert.equal(result.outgoing.date.toISOString(), result.incoming.date.toISOString());
  assert.equal(result.outgoing.categoryId, result.incoming.categoryId);
  assert.ok(result.outgoing.cardPaymentGroupId);
  assert.equal(result.outgoing.cardPaymentGroupId, result.incoming.cardPaymentGroupId);

  const category = await categories.findById('u1', result.outgoing.categoryId);
  assert.equal(category?.isSystemCardPayment, true);
  assert.equal(category?.name.value, 'PAGAMENTO DE FATURA');

  assert.equal((await transactions.listByUser('u1')).length, 2);
});

test('rejeita cardAccountId que nao e cartao de credito', async () => {
  const { transactions, useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...baseInput(), cardAccountId: 'acc-pri' }),
    InvalidCardPaymentAccountsError,
  );
  assert.equal((await transactions.listByUser('u1')).length, 0);
});

test('rejeita payingAccountId que e cartao de credito', async () => {
  const { transactions, useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...baseInput(), payingAccountId: 'acc-cartao2' }),
    InvalidCardPaymentAccountsError,
  );
  assert.equal((await transactions.listByUser('u1')).length, 0);
});

test('conta pagadora inexistente vira AccountNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...baseInput(), payingAccountId: 'inexistente' }),
    AccountNotFoundError,
  );
});

test('conta de cartao inexistente vira AccountNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...baseInput(), cardAccountId: 'inexistente' }),
    AccountNotFoundError,
  );
});

test('dois pagamentos seguidos reusam a mesma categoria de sistema (idempotente)', async () => {
  const { useCase } = await makeUseCase();

  const first = await useCase.execute(baseInput());
  const second = await useCase.execute({ ...baseInput(), amountCents: 1_000 });

  assert.equal(first.outgoing.categoryId, second.outgoing.categoryId);
  assert.notEqual(first.outgoing.cardPaymentGroupId, second.outgoing.cardPaymentGroupId);
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
    useCase.execute({ userId: '', payingAccountId: '', cardAccountId: '', amountCents: -1 }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.ok(error.fieldErrors['userId']);
      assert.ok(error.fieldErrors['payingAccountId']);
      assert.ok(error.fieldErrors['cardAccountId']);
      assert.ok(error.fieldErrors['amountCents']);
      return true;
    },
  );
});
