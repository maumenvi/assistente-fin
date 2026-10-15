import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RegisterFixedExpenseUseCase } from '../../../src/app/fixed-expense/register.fixed.expense.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeFixedExpenseRepository } from '../../../src/database/fake/fixed.expense.repository.fake.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { FakeAccountRepository } from '../../../src/database/fake/account.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { fakeCategories, DEFAULT_CATEGORY_ID } from '../../support/fake.categories.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const makeUseCase = async (options: { verified?: boolean; withAccount?: boolean } = {}) => {
  const { verified = true, withAccount = true } = options;
  const fixedExpenses = new FakeFixedExpenseRepository();
  const users = new FakeUserRepository();
  const accounts = new FakeAccountRepository();

  let user = User.create({
    id: 'u1',
    cpf: Cpf.create('52998224725'),
    email: Email.create('marco@exemplo.com'),
    phone: Phone.create('11987654321'),
    name: 'Marco',
    createdAt: NOW,
  });
  if (verified) user = user.verifyEmail(NOW).verifyPhone(NOW);
  await users.save(user);

  if (withAccount) {
    await accounts.save(
      Account.create({
        id: 'acc1',
        userId: 'u1',
        name: 'Carteira',
        kind: 'checking',
        openingBalance: Money.zero(),
      }),
    );
  }

  const categories = fakeCategories('u1', { 'cat-aluguel': 'Aluguel' });
  const useCase = new RegisterFixedExpenseUseCase(
    fixedExpenses,
    users,
    accounts,
    categories,
    new SequentialIdGenerator('fe'),
  );
  return { fixedExpenses, users, accounts, categories, useCase };
};

const validInput = {
  userId: 'u1',
  dueDay: 10,
  expectedAmountCents: 150_00,
  categoryName: '  Aluguel  ',
  accountId: 'acc1',
};

test('registra o gasto fixo com id gerado, nasce nao pago (RF-3, CA-3)', async () => {
  const { fixedExpenses, useCase } = await makeUseCase();

  const expense = await useCase.execute(validInput);

  assert.equal(expense.id, 'fe-1');
  assert.equal(expense.categoryId, 'cat-aluguel', 'reusou a categoria existente (CA-10)');
  assert.equal(expense.paid, false);
  assert.equal((await fixedExpenses.listByUser('u1')).length, 1);
});

test('entrada invalida vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...validInput, dueDay: 32, expectedAmountCents: -1 }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'registrar gasto fixo');
      assert.ok(error.fieldErrors['dueDay']);
      assert.ok(error.fieldErrors['expectedAmountCents']);
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

test('conta inexistente (ou de outro usuario) vira AccountNotFoundError', async () => {
  const { useCase } = await makeUseCase({ withAccount: false });

  await assert.rejects(useCase.execute(validInput), AccountNotFoundError);
});

test('registra com referenceMonth e description (spec 006, RF-1/RF-4)', async () => {
  const { useCase } = await makeUseCase();

  const expense = await useCase.execute({
    ...validInput,
    referenceMonth: 3,
    description: '  Netflix  ',
  });

  assert.equal(expense.referenceMonth, 3);
  assert.equal(expense.description, 'Netflix');
});

test('registra sem referenceMonth/description (ambos opcionais)', async () => {
  const { useCase } = await makeUseCase();

  const expense = await useCase.execute(validInput);

  assert.equal(expense.referenceMonth, null);
  assert.equal(expense.description, null);
});

test('referenceMonth invalido vira InvalidInputError antes do dominio (spec 006)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...validInput, referenceMonth: 13 }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.ok(error.fieldErrors['referenceMonth']);
      return true;
    },
  );
});
