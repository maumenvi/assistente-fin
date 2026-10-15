import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfirmVerificationUseCase } from '../../../src/app/verification/confirm.verification.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { InvalidVerificationCodeError } from '../../../src/domain/verification/invalid.verification.code.error.ts';
import { VerificationCodeExpiredError } from '../../../src/domain/verification/verification.code.expired.error.ts';
import { VerificationCodeAlreadyConfirmedError } from '../../../src/domain/verification/verification.code.already.confirmed.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { VerificationCode } from '../../../src/domain/verification/verification.code.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { FakeVerificationCodeRepository } from '../../../src/database/fake/verification.code.repository.fake.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const EXPIRES_AT = new Date('2026-01-01T00:15:00.000Z');

const makeUseCase = async (now = new Date('2026-01-01T00:05:00.000Z')) => {
  const users = new FakeUserRepository();
  await users.save(
    User.create({
      id: 'u1',
      cpf: Cpf.create('52998224725'),
      email: Email.create('marco@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Marco',
      createdAt: CREATED_AT,
    }),
  );

  const verificationCodes = new FakeVerificationCodeRepository();
  const useCase = new ConfirmVerificationUseCase(users, verificationCodes, new FixedClock(now));

  return { users, verificationCodes, useCase };
};

const seedCode = async (
  verificationCodes: FakeVerificationCodeRepository,
  overrides: Partial<Parameters<typeof VerificationCode.create>[0]> = {},
) =>
  verificationCodes.save(
    VerificationCode.create({
      id: 'vc1',
      userId: 'u1',
      channel: 'email',
      code: '123456',
      createdAt: CREATED_AT,
      expiresAt: EXPIRES_AT,
      ...overrides,
    }),
  );

test('codigo certo dentro do prazo confirma e marca o canal do usuario verificado (CA-22)', async () => {
  const { users, verificationCodes, useCase } = await makeUseCase();
  await seedCode(verificationCodes);

  const user = await useCase.execute({ userId: 'u1', channel: 'email', code: '123456' });

  assert.ok(user.emailVerifiedAt);
  assert.equal(user.phoneVerifiedAt, null, 'confirmar email nao verifica o telefone');
  assert.equal((await users.findById('u1'))?.emailVerifiedAt?.getTime(), user.emailVerifiedAt?.getTime());

  const saved = await verificationCodes.findLatestByUserAndChannel('u1', 'email');
  assert.ok(saved?.confirmedAt, 'o codigo deveria estar marcado como confirmado');
});

test('confirmar um canal ja deixa isVerified() true; os dois, hasAllChannelsVerified() (RF-28)', async () => {
  const { verificationCodes, useCase } = await makeUseCase();
  await seedCode(verificationCodes, { channel: 'email' });
  await seedCode(verificationCodes, { id: 'vc2', channel: 'phone' });

  const afterEmail = await useCase.execute({ userId: 'u1', channel: 'email', code: '123456' });
  assert.equal(afterEmail.isVerified(), true, 'um canal basta (decisao 2026-09-08)');
  assert.equal(afterEmail.hasAllChannelsVerified(), false);

  const user = await useCase.execute({ userId: 'u1', channel: 'phone', code: '123456' });
  assert.equal(user.hasAllChannelsVerified(), true);
});

test('codigo errado vira InvalidVerificationCodeError, sem verificar (CA-23)', async () => {
  const { users, useCase, verificationCodes } = await makeUseCase();
  await seedCode(verificationCodes);

  await assert.rejects(
    useCase.execute({ userId: 'u1', channel: 'email', code: '000000' }),
    InvalidVerificationCodeError,
  );
  assert.equal((await users.findById('u1'))?.emailVerifiedAt, null);
});

test('sem nenhum codigo solicitado vira InvalidVerificationCodeError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', channel: 'email', code: '123456' }),
    InvalidVerificationCodeError,
  );
});

test('codigo expirado vira VerificationCodeExpiredError (CA-23)', async () => {
  const { verificationCodes, useCase } = await makeUseCase(new Date('2026-01-01T00:16:00.000Z'));
  await seedCode(verificationCodes);

  await assert.rejects(
    useCase.execute({ userId: 'u1', channel: 'email', code: '123456' }),
    VerificationCodeExpiredError,
  );
});

test('confirmar o mesmo codigo duas vezes vira VerificationCodeAlreadyConfirmedError (CA-23)', async () => {
  const { verificationCodes, useCase } = await makeUseCase();
  await seedCode(verificationCodes);

  await useCase.execute({ userId: 'u1', channel: 'email', code: '123456' });

  await assert.rejects(
    useCase.execute({ userId: 'u1', channel: 'email', code: '123456' }),
    VerificationCodeAlreadyConfirmedError,
  );
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'inexistente', channel: 'email', code: '123456' }),
    UserNotFoundError,
  );
});

test('entrada invalida (zod) vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: '', channel: 'whatsapp', code: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'confirmar verificacao');
      assert.ok(error.fieldErrors['userId']);
      assert.ok(error.fieldErrors['channel']);
      assert.ok(error.fieldErrors['code']);
      return true;
    },
  );
});
