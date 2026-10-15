import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { fillMissingFromCapture } from '../../../src/domain/pre-registration/fill.missing.from.capture.ts';

const NOW = new Date('2026-09-24T12:00:00Z');
const draft = { origin: 'wallet' as const, amountCents: 4290, description: 'Mercado Dia', date: '2026-09-24', paymentMethod: 'credit-card' as const, confidence: 'high' as const };

test('fillMissingFromCapture: preenche so o que esta vazio', () => {
  const empty = PreRegistration.create({ id: 'p1', userId: 'u1', origin: 'wallet', createdAt: NOW });
  const patch = fillMissingFromCapture(empty, draft, 'nubank');
  assert.equal(patch.amount?.cents, 4290);
  assert.equal(patch.description, 'Mercado Dia');
  assert.equal(patch.date?.toISOString(), '2026-09-24T00:00:00.000Z');
  assert.equal(patch.paymentMethod, 'credit-card');
  assert.equal(patch.accountId, 'nubank');
});

test('fillMissingFromCapture: nunca sobrescreve campo preenchido', () => {
  const filled = PreRegistration.create({
    id: 'p1',
    userId: 'u1',
    origin: 'wallet',
    createdAt: NOW,
    amount: Money.fromCents(100),
    description: 'Ja tinha',
    date: NOW,
    paymentMethod: 'pix',
    accountId: 'conta',
  });
  assert.deepEqual(fillMissingFromCapture(filled, draft, 'nubank'), {});
});
