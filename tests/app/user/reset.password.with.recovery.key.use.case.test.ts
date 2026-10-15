import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResetPasswordWithRecoveryKeyUseCase } from '../../../src/app/user/reset.password.with.recovery.key.use.case.ts';
import { SetUserPasswordUseCase } from '../../../src/app/user/set.user.password.use.case.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { BadRecoveryKeyError } from '../../../src/domain/user/bad.recovery.key.error.ts';
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
  const recoveryKeys = new FakeRecoveryKeyGenerator();
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
  if (options.withPassword !== false) {
    await new SetUserPasswordUseCase(users, hasher, recoveryKeys).execute({
      userId: 'u1',
      password: 'antiga',
    });
  }
  return {
    users,
    useCase: new ResetPasswordWithRecoveryKeyUseCase(users, hasher, recoveryKeys),
  };
};

test('chave certa troca a senha e rotaciona a chave (RF-9b/RF-9c)', async () => {
  const { users, useCase } = await makeUseCase();

  const result = await useCase.execute({
    userId: 'u1',
    recoveryKey: 'RECOVERY-KEY-0001',
    newPassword: 'nova1234',
  });

  assert.equal(result.recoveryKey, 'RECOVERY-KEY-0002', 'nova chave');
  const persisted = await users.findById('u1');
  assert.equal(persisted?.passwordHash, 'hashed:nova1234');
  assert.equal(persisted?.recoveryKeyHash, 'hashed:RECOVERY-KEY-0002');
});

test('a chave antiga deixa de valer depois de usada', async () => {
  const { useCase } = await makeUseCase();

  await useCase.execute({ userId: 'u1', recoveryKey: 'RECOVERY-KEY-0001', newPassword: 'nova1234' });

  await assert.rejects(
    useCase.execute({ userId: 'u1', recoveryKey: 'RECOVERY-KEY-0001', newPassword: 'outra1234' }),
    BadRecoveryKeyError,
  );
});

test('chave errada vira BadRecoveryKeyError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', recoveryKey: 'CHAVE-ERRADA', newPassword: 'nova1234' }),
    BadRecoveryKeyError,
  );
});

test('usuario sem chave (sem senha) vira BadRecoveryKeyError', async () => {
  const { useCase } = await makeUseCase({ withPassword: false });

  await assert.rejects(
    useCase.execute({ userId: 'u1', recoveryKey: 'RECOVERY-KEY-0001', newPassword: 'nova1234' }),
    BadRecoveryKeyError,
  );
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'x', recoveryKey: 'RECOVERY-KEY-0001', newPassword: 'nova1234' }),
    UserNotFoundError,
  );
});
