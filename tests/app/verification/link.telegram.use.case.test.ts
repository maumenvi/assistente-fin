import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LinkTelegramUseCase } from '../../../src/app/verification/link.telegram.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const NOW = new Date('2026-03-01T12:00:00.000Z');

const build = async () => {
  const users = new FakeUserRepository();
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
  return { users, useCase: new LinkTelegramUseCase(users, new FixedClock(NOW)) };
};

test('vincula o chat_id e marca o telefone verificado', async () => {
  const { users, useCase } = await build();
  const linked = await useCase.execute({ userId: 'u1', chatId: '778899' });

  assert.equal(linked.telegramChatId, '778899');
  assert.equal(linked.phoneVerifiedAt?.getTime(), NOW.getTime());
  assert.equal(linked.isVerified(), true);
  assert.equal((await users.findById('u1'))?.telegramChatId, '778899');
});

test('usuario inexistente -> UserNotFoundError', async () => {
  const { useCase } = await build();
  await assert.rejects(useCase.execute({ userId: 'nao-existe', chatId: '1' }), UserNotFoundError);
});

test('chatId em branco -> InvalidInputError', async () => {
  const { useCase } = await build();
  await assert.rejects(useCase.execute({ userId: 'u1', chatId: '  ' }), InvalidInputError);
});
