import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { fillMissingFromPreRegistration } from '../../../src/domain/pre-registration/fill.missing.from.pre.registration.ts';

const pre = (id: string, extra: Partial<Parameters<typeof PreRegistration.create>[0]> = {}) =>
  PreRegistration.create({ id, userId: 'u1', origin: 'wallet', createdAt: new Date('2026-10-01T12:00:00Z'), ...extra });

test('completa so campos vazios, na ordem dos outros, sem sobrescrever', () => {
  const target = pre('a', { amount: Money.fromCents(1850) });
  const patch = fillMissingFromPreRegistration(target, [
    pre('b', { amount: Money.fromCents(9999), description: 'Café do Zé' }),
    pre('c', { description: 'outro', accountId: 'nubank', categoryId: 'cat1', notes: 'obs' }),
  ]);
  assert.equal(patch.amount, undefined, 'valor ja existia');
  assert.equal(patch.description, 'Café do Zé');
  assert.equal(patch.accountId, 'nubank');
  assert.equal(patch.categoryId, 'cat1');
  assert.equal(patch.notes, 'obs');
});

test('parcelas so entram com credito', () => {
  const credit = fillMissingFromPreRegistration(pre('a'), [pre('b', { paymentMethod: 'credit-card', installments: 3 })]);
  assert.equal(credit.paymentMethod, 'credit-card');
  assert.equal(credit.installments, 3);
  const pix = fillMissingFromPreRegistration(pre('a', { paymentMethod: 'pix' }), [pre('b', { paymentMethod: 'credit-card', installments: 3 })]);
  assert.equal(pix.installments, undefined);
});

test('nada a completar devolve patch vazio', () => {
  assert.deepEqual(fillMissingFromPreRegistration(pre('a'), [pre('b')]), {});
});
