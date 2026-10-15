import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CardPaymentNotFoundError } from '../../../src/domain/transaction/card.payment.not.found.error.ts';
import { DomainError } from '../../../src/domain/shared/domain.error.ts';

test('CardPaymentNotFoundError tem code estavel e e um DomainError', () => {
  const error = new CardPaymentNotFoundError();
  assert.ok(error instanceof DomainError);
  assert.equal(error.code, 'CARD_PAYMENT_NOT_FOUND');
  assert.equal(error.name, 'CardPaymentNotFoundError');
});
