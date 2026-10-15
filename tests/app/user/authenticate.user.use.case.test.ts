import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthenticateUserUseCase } from '../../../src/app/user/authenticate.user.use.case.ts';
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
      password: 'segredo',
    });
  }
  return { users, useCase: new AuthenticateUserUseCase(users, hasher) };
};

test('usuario sem senha entra so com o userId', async () => {
  const { useCase } = await makeUseCase();

  const user = await useCase.execute({ userId: 'u1' });
  assert.equal(user.id, 'u1');
});

test('usuario sem senha ignora uma senha informada', async () => {
  const { useCase } = await makeUseCase();

  const user = await useCase.execute({ userId: 'u1', password: 'qualquer' });
  assert.equal(user.id, 'u1');
});

test('usuario com senha: senha certa entra, errada vira BadCredentialsError', async () => {
  const { useCase } = await makeUseCase({ withPassword: true });

  const user = await useCase.execute({ userId: 'u1', password: 'segredo' });
  assert.equal(user.id, 'u1');

  await assert.rejects(useCase.execute({ userId: 'u1', password: 'errada' }), BadCredentialsError);
});

test('usuario com senha sem informar senha vira BadCredentialsError', async () => {
  const { useCase } = await makeUseCase({ withPassword: true });

  await assert.rejects(useCase.execute({ userId: 'u1' }), BadCredentialsError);
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ userId: 'inexistente' }), UserNotFoundError);
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ userId: '' }), (error: unknown) => {
    assert.ok(error instanceof InvalidInputError);
    assert.equal(error.context, 'autenticar usuario');
    return true;
  });
});
