import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RequestVerificationUseCase } from '../../../src/app/verification/request.verification.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { FakeVerificationCodeRepository } from '../../../src/database/fake/verification.code.repository.fake.ts';
import { FakeEmailSender } from '../../../src/notification/fake/email.sender.fake.ts';
import { FakeSmsSender } from '../../../src/notification/fake/sms.sender.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { FixedClock } from '../../support/fixed.clock.ts';
import { FixedCodeGenerator } from '../../support/fixed.code.generator.ts';

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

  const verificationCodes = new FakeVerificationCodeRepository();
  const emailSender = new FakeEmailSender();
  const smsSender = new FakeSmsSender();
  const useCase = new RequestVerificationUseCase(
    users,
    verificationCodes,
    new SequentialIdGenerator('vc'),
    new FixedClock(NOW),
    new FixedCodeGenerator('123456'),
    emailSender,
    smsSender,
  );

  return { users, verificationCodes, emailSender, smsSender, useCase };
};

test('canal email: gera, persiste (validade 15min) e envia so pelo EmailSender (RF-24, RF-25, CA-21)', async () => {
  const { verificationCodes, emailSender, smsSender, useCase } = await makeUseCase();

  await useCase.execute({ userId: 'u1', channel: 'email' });

  const saved = await verificationCodes.findLatestByUserAndChannel('u1', 'email');
  assert.equal(saved?.code, '123456');
  assert.equal(saved?.expiresAt.getTime(), NOW.getTime() + 15 * 60_000);
  assert.equal(saved?.confirmedAt, null);

  assert.deepEqual(emailSender.sent, [{ to: 'marco@exemplo.com', code: '123456' }]);
  assert.equal(smsSender.sent.length, 0);
});

test('canal phone: gera, persiste e envia so pelo SmsSender', async () => {
  const { verificationCodes, emailSender, smsSender, useCase } = await makeUseCase();

  await useCase.execute({ userId: 'u1', channel: 'phone' });

  const saved = await verificationCodes.findLatestByUserAndChannel('u1', 'phone');
  assert.equal(saved?.code, '123456');

  assert.deepEqual(smsSender.sent, [{ to: '+5511987654321', code: '123456' }]);
  assert.equal(emailSender.sent.length, 0);
});

test('entrada invalida (zod) vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: '', channel: 'whatsapp' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'solicitar verificacao');
      assert.ok(error.fieldErrors['userId']);
      assert.ok(error.fieldErrors['channel']);
      return true;
    },
  );
});

test('usuario inexistente vira UserNotFoundError, sem gerar nem enviar nada', async () => {
  const { verificationCodes, emailSender, useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'inexistente', channel: 'email' }),
    UserNotFoundError,
  );

  assert.equal(await verificationCodes.findLatestByUserAndChannel('inexistente', 'email'), null);
  assert.equal(emailSender.sent.length, 0);
});
