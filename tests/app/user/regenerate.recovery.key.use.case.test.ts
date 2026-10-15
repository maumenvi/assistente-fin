import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RegenerateRecoveryKeyUseCase } from '../../../src/app/user/regenerate.recovery.key.use.case.ts';
import { SetUserPasswordUseCase } from '../../../src/app/user/set.user.password.use.case.ts';
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
      password: 'segredo',
    });
  }
  return { users, useCase: new RegenerateRecoveryKeyUseCase(users, hasher, recoveryKeys) };
};

test('senha certa gera nova chave e nao mexe na senha (RF-9d)', async () => {
  const { users, useCase } = await makeUseCase();

  const result = await useCase.execute({ userId: 'u1', currentPassword: 'segredo' });

  assert.equal(result.recoveryKey, 'RECOVERY-KEY-0002');
  const persisted = await users.findById('u1');
  assert.equal(persisted?.recoveryKeyHash, 'hashed:RECOVERY-KEY-0002');
  assert.equal(persisted?.passwordHash, 'hashed:segredo', 'senha intacta');
});

test('senha errada (ou sem senha) vira BadCredentialsError', async () => {
  const comSenha = await makeUseCase();
  await assert.rejects(
    comSenha.useCase.execute({ userId: 'u1', currentPassword: 'errada' }),
    BadCredentialsError,
  );

  const semSenha = await makeUseCase({ withPassword: false });
  await assert.rejects(
    semSenha.useCase.execute({ userId: 'u1', currentPassword: 'qualquer' }),
    BadCredentialsError,
  );
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ userId: 'x', currentPassword: 'segredo' }), UserNotFoundError);
});
