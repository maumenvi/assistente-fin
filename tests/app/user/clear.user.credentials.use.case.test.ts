import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClearUserCredentialsUseCase } from '../../../src/app/user/clear.user.credentials.use.case.ts';
import { SetUserPasswordUseCase } from '../../../src/app/user/set.user.password.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { ConfirmationMismatchError } from '../../../src/domain/user/confirmation.mismatch.error.ts';
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
      cpf: Cpf.create('529.982.247-25'),
      email: Email.create('marco@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Marco',
      createdAt: NOW,
    }),
  );
  if (options.withPassword !== false) {
    await new SetUserPasswordUseCase(
      users,
      new FakePasswordHasher(),
      new FakeRecoveryKeyGenerator(),
    ).execute({ userId: 'u1', password: 'segredo' });
  }
  return { users, useCase: new ClearUserCredentialsUseCase(users) };
};

test('CPF certo (com ou sem mascara) limpa senha e chave (RF-9e)', async () => {
  const { users, useCase } = await makeUseCase();

  const updated = await useCase.execute({ userId: 'u1', confirmationCpf: '52998224725' });
  assert.equal(updated.hasPassword(), false);

  const persisted = await users.findById('u1');
  assert.equal(persisted?.passwordHash, null);
  assert.equal(persisted?.recoveryKeyHash, null);
});

test('CPF com mascara tambem serve', async () => {
  const { useCase } = await makeUseCase();

  const updated = await useCase.execute({ userId: 'u1', confirmationCpf: '529.982.247-25' });
  assert.equal(updated.hasPassword(), false);
});

test('CPF errado vira ConfirmationMismatchError, nada muda', async () => {
  const { users, useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', confirmationCpf: '11111111111' }),
    ConfirmationMismatchError,
  );
  assert.equal((await users.findById('u1'))?.hasPassword(), true);
});

test('usuario sem senha e idempotente (CPF certo), nao lanca', async () => {
  const { useCase } = await makeUseCase({ withPassword: false });

  const updated = await useCase.execute({ userId: 'u1', confirmationCpf: '52998224725' });
  assert.equal(updated.hasPassword(), false);
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'x', confirmationCpf: '52998224725' }),
    UserNotFoundError,
  );
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ userId: 'u1', confirmationCpf: '' }), (error: unknown) => {
    assert.ok(error instanceof InvalidInputError);
    assert.equal(error.context, 'redefinir acesso localmente');
    return true;
  });
});
