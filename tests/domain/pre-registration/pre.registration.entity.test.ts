import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { InvalidPreRegistrationError } from '../../../src/domain/pre-registration/invalid.pre.registration.error.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';

const NOW = new Date('2026-09-24T12:00:00.000Z');
const base = { id: 'p1', userId: 'u1', origin: 'manual' as const, createdAt: NOW };

test('aceita dados incompletos e informa o que falta para aprovar (FR-022, FR-024)', () => {
  const pre = PreRegistration.create({ ...base, description: '  Queijo  ' });
  assert.equal(pre.description, 'Queijo');
  assert.equal(pre.needsReview, false);
  assert.equal(pre.manualOnly, false);
  assert.deepEqual(pre.missingForApproval(), ['amount', 'date', 'accountId', 'paymentMethod']);

  const complete = pre.update({
    amount: Money.fromCents(6500),
    date: NOW,
    accountId: 'itau',
    paymentMethod: 'pix',
  });
  assert.deepEqual(complete.missingForApproval(), [], 'categoria nao e obrigatoria');
});

test('origem e imutavel e so aceita os valores conhecidos', () => {
  assert.throws(
    () => PreRegistration.create({ ...base, origin: 'fax' as never }),
    InvalidPreRegistrationError,
  );
  const pre = PreRegistration.create({ ...base, origin: 'voice' });
  assert.equal(pre.update({ description: 'x' }).origin, 'voice');
});

test('valor > 0 quando presente; descricao trim e <= 200', () => {
  assert.throws(() => PreRegistration.create({ ...base, amount: Money.zero() }), InvalidPreRegistrationError);
  assert.throws(() => PreRegistration.create({ ...base, description: 'x'.repeat(201) }), InvalidPreRegistrationError);
  assert.equal(PreRegistration.create({ ...base, description: '   ' }).description, null);
});

test('parcelas 1..48 e so no credito', () => {
  assert.throws(() => PreRegistration.create({ ...base, installments: 49, paymentMethod: 'credit-card' }), InvalidPreRegistrationError);
  assert.throws(() => PreRegistration.create({ ...base, installments: 0 }), InvalidPreRegistrationError);
  assert.throws(() => PreRegistration.create({ ...base, installments: 2, paymentMethod: 'pix' }), InvalidPreRegistrationError);
  assert.equal(PreRegistration.create({ ...base, installments: 2, paymentMethod: 'credit-card' }).installments, 2);
});

test('possivel duplicata e aparelho de origem sao opcionais', () => {
  const pre = PreRegistration.create({ ...base, possibleDuplicateOf: 't9', sourceDevice: 'Pixel 8' });
  assert.equal(pre.possibleDuplicateOf, 't9');
  assert.equal(pre.sourceDevice, 'Pixel 8');
});

test('withUpdatedAt carimba a versao', () => {
  const stamped = PreRegistration.create(base).withUpdatedAt(NOW);
  assert.equal(stamped.updatedAt?.toISOString(), NOW.toISOString());
});

test('duplicateReviewed comeca falso e, ao ser marcado, zera possibleDuplicateOf (spec 028)', () => {
  const pre = PreRegistration.create({ ...base, possibleDuplicateOf: 'p0' });
  assert.equal(pre.duplicateReviewed, false);
  assert.equal(pre.possibleDuplicateOf, 'p0');
  const reviewed = pre.update({ duplicateReviewed: true });
  assert.equal(reviewed.duplicateReviewed, true);
  assert.equal(reviewed.possibleDuplicateOf, null);
  assert.equal(PreRegistration.create({ ...base, duplicateReviewed: true, possibleDuplicateOf: 'p0' }).possibleDuplicateOf, null);
});
