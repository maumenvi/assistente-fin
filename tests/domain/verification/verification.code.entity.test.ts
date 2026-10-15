import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VerificationCode } from '../../../src/domain/verification/verification.code.entity.ts';
import { InvalidVerificationCodeError } from '../../../src/domain/verification/invalid.verification.code.error.ts';
import { VerificationCodeExpiredError } from '../../../src/domain/verification/verification.code.expired.error.ts';
import { VerificationCodeAlreadyConfirmedError } from '../../../src/domain/verification/verification.code.already.confirmed.error.ts';

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const EXPIRES_AT = new Date('2026-01-01T00:15:00.000Z');

const base = () => ({
  id: 'vc-1',
  userId: 'user-1',
  channel: 'email' as const,
  code: '123456',
  expiresAt: EXPIRES_AT,
  createdAt: CREATED_AT,
});

test('create nasce nao confirmado (RF-24)', () => {
  const code = VerificationCode.create(base());
  assert.equal(code.confirmedAt, null);
  assert.equal(code.channel, 'email');
});

test('create rejeita campos invalidos', () => {
  assert.throws(() => VerificationCode.create({ ...base(), id: '' }), InvalidVerificationCodeError);
  assert.throws(() => VerificationCode.create({ ...base(), userId: '' }), InvalidVerificationCodeError);
  assert.throws(
    // @ts-expect-error canal invalido de proposito
    () => VerificationCode.create({ ...base(), channel: 'whatsapp' }),
    InvalidVerificationCodeError,
  );
  assert.throws(() => VerificationCode.create({ ...base(), code: '123' }), InvalidVerificationCodeError);
  assert.throws(() => VerificationCode.create({ ...base(), code: 'abcdef' }), InvalidVerificationCodeError);
  assert.throws(
    () => VerificationCode.create({ ...base(), expiresAt: CREATED_AT }),
    InvalidVerificationCodeError,
    'expiresAt igual a createdAt deveria ser invalido',
  );
});

test('confirm marca confirmedAt quando dentro do prazo (CA-22)', () => {
  const code = VerificationCode.create(base());
  const now = new Date('2026-01-01T00:05:00.000Z');

  const confirmed = code.confirm(now);
  assert.equal(confirmed.confirmedAt, now);
  assert.equal(code.confirmedAt, null, 'nao muta o original');
});

test('confirm depois do prazo lanca VerificationCodeExpiredError (CA-23)', () => {
  const code = VerificationCode.create(base());
  const afterExpiry = new Date('2026-01-01T00:16:00.000Z');

  assert.throws(() => code.confirm(afterExpiry), VerificationCodeExpiredError);
});

test('confirm de novo lanca VerificationCodeAlreadyConfirmedError (CA-23)', () => {
  const code = VerificationCode.create(base());
  const confirmed = code.confirm(new Date('2026-01-01T00:05:00.000Z'));

  assert.throws(
    () => confirmed.confirm(new Date('2026-01-01T00:06:00.000Z')),
    VerificationCodeAlreadyConfirmedError,
  );
});

test('isExpired reflete o prazo em relacao a `now`', () => {
  const code = VerificationCode.create(base());
  assert.equal(code.isExpired(new Date('2026-01-01T00:14:59.000Z')), false);
  assert.equal(code.isExpired(new Date('2026-01-01T00:15:01.000Z')), true);
});

test('fromPersistence reconstroi (inclusive ja confirmado) reaplicando as invariantes', () => {
  const confirmedAt = new Date('2026-01-01T00:05:00.000Z');
  const code = VerificationCode.fromPersistence({ ...base(), confirmedAt });
  assert.equal(code.confirmedAt, confirmedAt);

  assert.throws(
    () => VerificationCode.fromPersistence({ ...base(), id: '', confirmedAt: null }),
    InvalidVerificationCodeError,
  );
});
