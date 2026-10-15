import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SetUserPasswordUseCase } from '../../../src/app/user/set.user.password.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { PasswordAlreadySetError } from '../../../src/domain/user/password.already.set.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { FakePasswordHasher } from '../../support/fake.password.hasher.ts';
import { FakeRecoveryKeyGenerator } from '../../support/fake.recovery.key.generator.ts';

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
  const useCase = new SetUserPasswordUseCase(
    users,
    new FakePasswordHasher(),
    new FakeRecoveryKeyGenerator(),
  );
  return { users, useCase };
};

test('define a senha, grava so o hash e devolve a chave de recuperacao uma vez (RF-9, RF-9c)', async () => {
  const { users, useCase } = await makeUseCase();

  const result = await useCase.execute({ userId: 'u1', password: 'segredo' });

  assert.equal(result.recoveryKey, 'RECOVERY-KEY-0001');
  assert.equal(result.user.hasPassword(), true);

  const persisted = await users.findById('u1');
  assert.equal(persisted?.passwordHash, 'hashed:segredo');
  assert.equal(persisted?.recoveryKeyHash, 'hashed:RECOVERY-KEY-0001');
});

test('rejeita quando o usuario ja tem senha (PasswordAlreadySetError)', async () => {
  const { useCase } = await makeUseCase();
  await useCase.execute({ userId: 'u1', password: 'segredo' });

  await assert.rejects(
    useCase.execute({ userId: 'u1', password: 'outra' }),
    PasswordAlreadySetError,
  );
});

test('senha com menos de 4 caracteres vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ userId: 'u1', password: 'abc' }), (error: unknown) => {
    assert.ok(error instanceof InvalidInputError);
    assert.equal(error.context, 'definir senha');
    assert.ok(error.fieldErrors['password']);
    return true;
  });
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'inexistente', password: 'segredo' }),
    UserNotFoundError,
  );
});
