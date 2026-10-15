import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChangeUserPasswordUseCase } from '../../../src/app/user/change.user.password.use.case.ts';
import { SetUserPasswordUseCase } from '../../../src/app/user/set.user.password.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { BadCredentialsError } from '../../../src/domain/user/bad.credentials.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { FakePasswordHasher } from '../../support/fake.password.hasher.ts';
import { FakeRecoveryKeyGenerator } from '../../support/fake.recovery.key.generator.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const makeUseCase = async (options: { withPassword?: boolean } = {}) => {
  const users = new FakeUserRepository();
  const hasher = new FakePasswordHasher();
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
  if (options.withPassword) {
    await new SetUserPasswordUseCase(users, hasher, new FakeRecoveryKeyGenerator()).execute({
      userId: 'u1',
      password: 'atual',
    });
  }
  return { users, useCase: new ChangeUserPasswordUseCase(users, hasher) };
};

test('troca o hash da senha e preserva a chave de recuperacao (RF-9a)', async () => {
  const { users, useCase } = await makeUseCase({ withPassword: true });

  await useCase.execute({ userId: 'u1', currentPassword: 'atual', newPassword: 'nova1234' });

  const persisted = await users.findById('u1');
  assert.equal(persisted?.passwordHash, 'hashed:nova1234');
  assert.equal(persisted?.recoveryKeyHash, 'hashed:RECOVERY-KEY-0001', 'nao mexe na chave');
});

test('senha atual errada vira BadCredentialsError', async () => {
  const { useCase } = await makeUseCase({ withPassword: true });

  await assert.rejects(
    useCase.execute({ userId: 'u1', currentPassword: 'errada', newPassword: 'nova1234' }),
    BadCredentialsError,
  );
});

test('usuario sem senha nenhuma tambem vira BadCredentialsError', async () => {
  const { useCase } = await makeUseCase({ withPassword: false });

  await assert.rejects(
    useCase.execute({ userId: 'u1', currentPassword: 'qualquer', newPassword: 'nova1234' }),
    BadCredentialsError,
  );
});

test('nova senha curta vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase({ withPassword: true });

  await assert.rejects(
    useCase.execute({ userId: 'u1', currentPassword: 'atual', newPassword: 'ab' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'trocar senha');
      return true;
    },
  );
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'x', currentPassword: 'a', newPassword: 'nova1234' }),
    UserNotFoundError,
  );
});
