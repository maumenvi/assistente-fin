import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RegisterIncomeUseCase } from '../../../src/app/income/register.income.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { seedDefaultCategory, DEFAULT_CATEGORY_ID } from '../../support/fake.categories.ts';
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
  if (verified) user = user.verifyEmail(NOW).verifyPhone(NOW);
  await database.users.save(user);

  // a categoria 'Trabalho' ja existe: assim `resolveCategoryId` reusa e nao consome um id do
  // mesmo gerador, que deslocaria o id do proprio ganho
  await seedDefaultCategory(database.categories, 'u1');
  await database.categories.save(
    Category.create({ id: 'cat-trabalho', userId: 'u1', name: CategoryName.create('Trabalho') }),
  );
  await database.accounts.save(
    Account.create({
      id: 'acc1',
      userId: 'u1',
      name: 'Conta Corrente',
      kind: 'checking',
      openingBalance: Money.zero(),
    }),
  );

  const useCase = new RegisterIncomeUseCase(database, new SequentialIdGenerator('income'));
  return { database, useCase };
};

const validInput = {
  userId: 'u1',
  date: '2026-01-05T00:00:00.000Z',
  amountCents: 500_000,
  source: '  Salario  ',
  recurrence: { frequency: 'mensal', endDate: '2026-11-05T00:00:00.000Z' },
  categoryName: '  Trabalho  ',
  notes: 'observacao',
};

test('registra o ganho com id gerado e a persiste (RF-2, CA-2)', async () => {
  const { database, useCase } = await makeUseCase();

  const income = await useCase.execute(validInput);

  assert.equal(income.id, 'income-1');
  assert.equal(income.source, 'Salario');
  assert.equal(income.categoryId, 'cat-trabalho', 'reusou a categoria existente (CA-10)');
  assert.equal(income.amount.cents, 500_000);
  assert.equal(income.recurrence.frequency, 'mensal');
  assert.equal((await database.incomes.listByUser('u1')).length, 1);
  assert.equal(income.accountId, null, 'sem accountId no input, RF-4');
});

test('entrada invalida vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...validInput, amountCents: -1, source: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'registrar ganho');
      assert.ok(error.fieldErrors['amountCents']);
      assert.ok(error.fieldErrors['source']);
      return true;
    },
  );
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...validInput, userId: 'inexistente' }),
    UserNotFoundError,
  );
});

test('usuario nao verificado vira UserNotVerifiedError (RF-28)', async () => {
  const { useCase } = await makeUseCase({ verified: false });

  await assert.rejects(useCase.execute(validInput), UserNotVerifiedError);
});

test('nao persiste nada quando a entrada e invalida ou o usuario nao pode agir', async () => {
  const { database, useCase } = await makeUseCase();

  await useCase.execute(validInput);
  await useCase.execute({ ...validInput, amountCents: -1 }).catch(() => undefined);
  await useCase.execute({ ...validInput, userId: 'inexistente' }).catch(() => undefined);

  assert.equal((await database.incomes.listByUser('u1')).length, 1);
});

test('sem categoria informada, o ganho cai na padrao (spec 003, CA-7)', async () => {
  const { useCase } = await makeUseCase();

  const { categoryName, ...semCategoria } = validInput;
  const income = await useCase.execute(semCategoria);

  assert.equal(income.categoryId, DEFAULT_CATEGORY_ID);
});

test('categoria digitada que nao existe e criada e vinculada (spec 003, CA-9)', async () => {
  const { database, useCase } = await makeUseCase();

  const income = await useCase.execute({ ...validInput, categoryName: 'freelas' });

  const created = await database.categories.findById('u1', income.categoryId);
  assert.equal(created?.name.value, 'FREELAS');
});

test('com accountId: salva o Income vinculado a conta, sem criar Transaction/TransactionSeries (spec 012, RF-1/RF-2)', async () => {
  const { database, useCase } = await makeUseCase();

  const income = await useCase.execute({ ...validInput, accountId: 'acc1' });

  assert.equal(income.accountId, 'acc1');
  assert.equal((await database.transactionSeries.listByUser('u1')).length, 0);
  assert.equal((await database.transactions.listByUser('u1')).length, 0);
});

test('com accountId de outro usuario/inexistente vira AccountNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...validInput, accountId: 'inexistente' }),
    AccountNotFoundError,
  );
});

test('accountId invalido nao cria nenhum Income (validado antes de salvar)', async () => {
  const { database, useCase } = await makeUseCase();

  await useCase.execute(validInput); // 1 ganho valido, sem conta
  await useCase.execute({ ...validInput, accountId: 'inexistente' }).catch(() => undefined);

  assert.equal((await database.incomes.listByUser('u1')).length, 1, 'nenhum Income extra criado');
  assert.equal((await database.transactionSeries.listByUser('u1')).length, 0);
});
