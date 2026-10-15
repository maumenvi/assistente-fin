import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SetSpendingLimitUseCase } from '../../../src/app/spending-limit/set.spending.limit.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeSpendingLimitRepository } from '../../../src/database/fake/spending.limit.repository.fake.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { fakeCategories, DEFAULT_CATEGORY_ID } from '../../support/fake.categories.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const makeUseCase = async (options: { verified?: boolean } = {}) => {
  const { verified = true } = options;
  const spendingLimits = new FakeSpendingLimitRepository();
  const users = new FakeUserRepository();

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

  const categories = fakeCategories('u1', { 'cat-lazer': 'Lazer' });
  const useCase = new SetSpendingLimitUseCase(
    spendingLimits,
    users,
    categories,
    new SequentialIdGenerator('sl'),
  );
  return { spendingLimits, users, categories, useCase };
};

const validInput = {
  userId: 'u1',
  categoryName: '  Lazer  ',
  period: { year: 2026, month: 1 },
  maxAmountCents: 50_000,
};

test('define o limite com id gerado e a persiste (RF-4)', async () => {
  const { spendingLimits, useCase } = await makeUseCase();

  const limit = await useCase.execute(validInput);

  assert.equal(limit.id, 'sl-1');
  assert.equal(limit.categoryId, 'cat-lazer', 'reusou a categoria existente (CA-10)');
  assert.equal(limit.period.toString(), '2026-01');
  assert.equal(limit.maxAmount.cents, 50_000);
  assert.equal((await spendingLimits.listByUser('u1')).length, 1);
});

test('entrada invalida vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...validInput, maxAmountCents: -1, period: { year: 2026, month: 13 } }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'definir limite de gasto');
      assert.ok(error.fieldErrors['maxAmountCents']);
      assert.ok(error.fieldErrors['period']);
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
