import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SetUserLowBalanceThresholdUseCase } from '../../../src/app/user/set.user.low.balance.threshold.use.case.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const makeUseCase = async () => {
  const users = new FakeUserRepository();

  await users.save(
    User.create({
      id: 'u1',
      cpf: Cpf.create('52998224725'),
      email: Email.create('marco@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Marco',
      createdAt: NOW,
    }),
  );

  return { users, useCase: new SetUserLowBalanceThresholdUseCase(users) };
};

test('define um limite valido e persiste', async () => {
  const { users, useCase } = await makeUseCase();

  const updated = await useCase.execute({ userId: 'u1', thresholdCents: 50_000 });
  assert.equal(updated.lowBalanceThresholdCents, 50_000);

  const persisted = await users.findById('u1');
  assert.equal(persisted?.lowBalanceThresholdCents, 50_000);
});

test('thresholdCents nulo limpa a preferencia (volta ao padrao do sistema)', async () => {
  const { users, useCase } = await makeUseCase();

  await useCase.execute({ userId: 'u1', thresholdCents: 50_000 });
  const cleared = await useCase.execute({ userId: 'u1', thresholdCents: null });
  assert.equal(cleared.lowBalanceThresholdCents, null);

  const persisted = await users.findById('u1');
  assert.equal(persisted?.lowBalanceThresholdCents, null);
});

test('valor negativo vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', thresholdCents: -1 }),
    InvalidInputError,
  );
});

test('valor decimal vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', thresholdCents: 1.5 }),
    InvalidInputError,
  );
});

test('userId inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u-inexistente', thresholdCents: 50_000 }),
    UserNotFoundError,
  );
});
