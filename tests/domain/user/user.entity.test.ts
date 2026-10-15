import { test } from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../../../src/domain/user/user.entity.ts';
import { InvalidUserError } from '../../../src/domain/user/invalid.user.error.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const base = () => ({
  id: 'user-1',
  cpf: Cpf.create('529.982.247-25'),
  email: Email.create('marco@exemplo.com'),
  phone: Phone.create('11987654321'),
  name: '  Marco  ',
  createdAt: NOW,
});

test('create normaliza o nome, preserva cpf/email/phone/createdAt e nasce nao verificado (RF-15, RF-23, RF-26)', () => {
  const user = User.create(base());

  assert.equal(user.name, 'Marco');
  assert.equal(user.id, 'user-1');
  assert.ok(user.cpf.equals(Cpf.create('52998224725')));
  assert.equal(user.email.value, 'marco@exemplo.com');
  assert.equal(user.phone.value, '+5511987654321');
  assert.equal(user.createdAt.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(user.emailVerifiedAt, null);
  assert.equal(user.phoneVerifiedAt, null);
  assert.equal(user.isVerified(), false);
  assert.equal(user.hasAllChannelsVerified(), false);
  assert.equal(user.passwordHash, null);
  assert.equal(user.recoveryKeyHash, null);
  assert.equal(user.hasPassword(), false);
});

test('setPassword/setRecoveryKey/removePassword sao imutaveis (spec 002, RF-9)', () => {
  const user = User.create(base());

  const withPassword = user.setPassword('scrypt$hash').setRecoveryKey('scrypt$rk');
  assert.equal(withPassword.passwordHash, 'scrypt$hash');
  assert.equal(withPassword.recoveryKeyHash, 'scrypt$rk');
  assert.equal(withPassword.hasPassword(), true);
  assert.equal(user.hasPassword(), false, 'nao muta o original');

  const cleared = withPassword.removePassword();
  assert.equal(cleared.passwordHash, null);
  assert.equal(cleared.recoveryKeyHash, null);
  assert.equal(cleared.hasPassword(), false);
});

test('build rejeita hash vazio', () => {
  assert.throws(
    () => User.fromPersistence({ ...base(), emailVerifiedAt: null, phoneVerifiedAt: null, passwordHash: '   ' }),
    InvalidUserError,
  );
});

test('create rejeita campos obrigatorios invalidos', () => {
  assert.throws(() => User.create({ ...base(), id: '  ' }), InvalidUserError);
  assert.throws(() => User.create({ ...base(), name: '   ' }), InvalidUserError);
  assert.throws(() => User.create({ ...base(), name: 'x'.repeat(121) }), InvalidUserError);
  assert.throws(
    // @ts-expect-error cpf invalido de proposito
    () => User.create({ ...base(), cpf: '52998224725' }),
    InvalidUserError,
  );
  assert.throws(
    // @ts-expect-error email invalido de proposito
    () => User.create({ ...base(), email: 'marco@exemplo.com' }),
    InvalidUserError,
  );
  assert.throws(
    // @ts-expect-error phone invalido de proposito
    () => User.create({ ...base(), phone: '11987654321' }),
    InvalidUserError,
  );
  assert.throws(
    () => User.create({ ...base(), createdAt: new Date('invalido') }),
    InvalidUserError,
  );
});

test('verifyEmail/verifyPhone marcam o canal e sao imutaveis e idempotentes', () => {
  const user = User.create(base());

  const withEmail = user.verifyEmail(NOW);
  assert.equal(withEmail.emailVerifiedAt, NOW);
  assert.equal(user.emailVerifiedAt, null, 'nao muta o original');
  assert.equal(withEmail.isVerified(), true, 'um canal ja basta (decisao 2026-09-08)');
  assert.equal(withEmail.hasAllChannelsVerified(), false);

  const later = new Date('2026-01-02T00:00:00.000Z');
  assert.equal(
    withEmail.verifyEmail(later).emailVerifiedAt,
    NOW,
    'idempotente: ja verificado nao muda a data',
  );

  const fully = withEmail.verifyPhone(NOW);
  assert.equal(fully.isVerified(), true);
  assert.equal(fully.hasAllChannelsVerified(), true);
});

test('linkTelegram grava o chat_id e ja verifica o telefone; preserva a 1a data', () => {
  const user = User.create(base());
  assert.equal(user.telegramChatId, null);

  const linked = user.linkTelegram('  99887766  ', NOW);
  assert.equal(linked.telegramChatId, '99887766', 'trima o chat_id');
  assert.equal(linked.phoneVerifiedAt, NOW);
  assert.equal(user.telegramChatId, null, 'nao muta o original');

  const later = new Date('2026-02-01T00:00:00.000Z');
  const relinked = linked.linkTelegram('55443322', later);
  assert.equal(relinked.telegramChatId, '55443322', 'revincular troca o chat_id');
  assert.equal(relinked.phoneVerifiedAt, NOW, 'mantem a data da 1a verificacao');

  assert.throws(() => user.linkTelegram('   ', NOW), InvalidUserError);
});

test('setDefaultAccount define/limpa a preferencia de conta padrao e e imutavel (spec 007, RF-3, RF-4)', () => {
  const user = User.create(base());
  assert.equal(user.defaultAccountId, null);

  const withDefault = user.setDefaultAccount('account-1');
  assert.equal(withDefault.defaultAccountId, 'account-1');
  assert.equal(user.defaultAccountId, null, 'nao muta o original');

  const cleared = withDefault.setDefaultAccount(null);
  assert.equal(cleared.defaultAccountId, null);
  assert.equal(withDefault.defaultAccountId, 'account-1', 'nao muta o original');
});

test('setLowBalanceThreshold define/limpa o limite e e imutavel (spec 015, RF-2)', () => {
  const user = User.create(base());
  assert.equal(user.lowBalanceThresholdCents, null);

  const withThreshold = user.setLowBalanceThreshold(50_000);
  assert.equal(withThreshold.lowBalanceThresholdCents, 50_000);
  assert.equal(user.lowBalanceThresholdCents, null, 'nao muta o original');

  const cleared = withThreshold.setLowBalanceThreshold(null);
  assert.equal(cleared.lowBalanceThresholdCents, null);
  assert.equal(withThreshold.lowBalanceThresholdCents, 50_000, 'nao muta o original');
});

test('setLowBalanceThreshold rejeita valor negativo ou nao inteiro (spec 015, RF-2)', () => {
  const user = User.create(base());
  assert.throws(() => user.setLowBalanceThreshold(-1), InvalidUserError);
  assert.throws(() => user.setLowBalanceThreshold(1.5), InvalidUserError);
});

test('fromPersistence reconstroi (com status de verificacao e credencial) reaplicando as mesmas invariantes', () => {
  const user = User.fromPersistence({
    ...base(),
    emailVerifiedAt: NOW,
    phoneVerifiedAt: null,
    passwordHash: 'scrypt$hash',
    recoveryKeyHash: 'scrypt$rk',
  });
  assert.equal(user.name, 'Marco');
  assert.equal(user.emailVerifiedAt, NOW);
  assert.equal(user.phoneVerifiedAt, null);
  assert.equal(user.passwordHash, 'scrypt$hash');
  assert.equal(user.hasPassword(), true);

  assert.throws(
    () => User.fromPersistence({ ...base(), id: '', emailVerifiedAt: null, phoneVerifiedAt: null }),
    InvalidUserError,
  );
  assert.throws(
    () =>
      User.fromPersistence({
        ...base(),
        emailVerifiedAt: new Date('invalido'),
        phoneVerifiedAt: null,
      }),
    InvalidUserError,
  );
});
