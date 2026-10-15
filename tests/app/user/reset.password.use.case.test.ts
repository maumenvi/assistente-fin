import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResetPasswordUseCase } from '../../../src/app/user/reset.password.use.case.ts';
import { SetUserPasswordUseCase } from '../../../src/app/user/set.user.password.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { InvalidVerificationCodeError } from '../../../src/domain/verification/invalid.verification.code.error.ts';
import { VerificationCodeExpiredError } from '../../../src/domain/verification/verification.code.expired.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { VerificationCode } from '../../../src/domain/verification/verification.code.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { FakeVerificationCodeRepository } from '../../../src/database/fake/verification.code.repository.fake.ts';
import { FakePasswordHasher } from '../../support/fake.password.hasher.ts';
import { FakeRecoveryKeyGenerator } from '../../support/fake.recovery.key.generator.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const NOW = new Date('2026-03-01T12:00:00.000Z');

const makeUseCase = async (options: { codeExpiresAt?: Date } = {}) => {
  const users = new FakeUserRepository();
  const codes = new FakeVerificationCodeRepository();
  const hasher = new FakePasswordHasher();
  await users.save(
    User.create({
      id: 'u1',
      cpf: Cpf.create('52998224725'),
      email: Email.create('marco@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Marco',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
  );
  await new SetUserPasswordUseCase(users, hasher, new FakeRecoveryKeyGenerator()).execute({
    userId: 'u1',
    password: 'antiga',
  });
  await codes.save(
    VerificationCode.create({
      id: 'vc1',
      userId: 'u1',
      channel: 'email',
      code: '123456',
      expiresAt: options.codeExpiresAt ?? new Date('2026-03-01T12:15:00.000Z'),
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
    }),
  );
  return {
    users,
    codes,
    useCase: new ResetPasswordUseCase(users, codes, hasher, new FixedClock(NOW)),
  };
};

test('codigo certo troca a senha e consome o codigo (RF-9b)', async () => {
  const { users, codes, useCase } = await makeUseCase();

  await useCase.execute({ userId: 'u1', channel: 'email', code: '123456', newPassword: 'nova1234' });

  assert.equal((await users.findById('u1'))?.passwordHash, 'hashed:nova1234');
  assert.ok((await codes.findLatestByUserAndChannel('u1', 'email'))?.confirmedAt, 'codigo consumido');
});

test('a chave de recuperacao nao muda no reset por codigo', async () => {
  const { users, useCase } = await makeUseCase();

  await useCase.execute({ userId: 'u1', channel: 'email', code: '123456', newPassword: 'nova1234' });

  assert.equal((await users.findById('u1'))?.recoveryKeyHash, 'hashed:RECOVERY-KEY-0001');
});

test('codigo errado vira InvalidVerificationCodeError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', channel: 'email', code: '000000', newPassword: 'nova1234' }),
    InvalidVerificationCodeError,
  );
});

test('codigo expirado vira VerificationCodeExpiredError', async () => {
  const { useCase } = await makeUseCase({ codeExpiresAt: new Date('2026-03-01T11:00:00.000Z') });

  await assert.rejects(
    useCase.execute({ userId: 'u1', channel: 'email', code: '123456', newPassword: 'nova1234' }),
    VerificationCodeExpiredError,
  );
});

test('canal sem codigo vira InvalidVerificationCodeError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', channel: 'phone', code: '123456', newPassword: 'nova1234' }),
    InvalidVerificationCodeError,
  );
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'x', channel: 'email', code: '123456', newPassword: 'nova1234' }),
    UserNotFoundError,
  );
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', channel: 'email', code: '123456', newPassword: 'ab' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'redefinir senha');
      return true;
    },
  );
});
