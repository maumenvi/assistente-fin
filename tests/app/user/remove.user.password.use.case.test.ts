import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RemoveUserPasswordUseCase } from '../../../src/app/user/remove.user.password.use.case.ts';
import { SetUserPasswordUseCase } from '../../../src/app/user/set.user.password.use.case.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
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
    await new SetUserPasswordUseCase(
      users,
      new FakePasswordHasher(),
      new FakeRecoveryKeyGenerator(),
    ).execute({ userId: 'u1', password: 'segredo' });
  }
  return { users, useCase: new RemoveUserPasswordUseCase(users) };
};

test('remove limpa senha e chave de recuperacao (RF-9)', async () => {
  const { users, useCase } = await makeUseCase({ withPassword: true });

  const updated = await useCase.execute({ userId: 'u1' });
  assert.equal(updated.hasPassword(), false);

  const persisted = await users.findById('u1');
  assert.equal(persisted?.passwordHash, null);
  assert.equal(persisted?.recoveryKeyHash, null);
});

test('remover de usuario sem senha e idempotente, nao lanca', async () => {
  const { useCase } = await makeUseCase({ withPassword: false });

  const updated = await useCase.execute({ userId: 'u1' });
  assert.equal(updated.hasPassword(), false);
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ userId: 'inexistente' }), UserNotFoundError);
});
