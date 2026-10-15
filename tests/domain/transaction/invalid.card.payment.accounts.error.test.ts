import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InvalidCardPaymentAccountsError } from '../../../src/domain/transaction/invalid.card.payment.accounts.error.ts';
import { DomainError } from '../../../src/domain/shared/domain.error.ts';

test('InvalidCardPaymentAccountsError tem code estavel e e um DomainError', () => {
  const error = new InvalidCardPaymentAccountsError();
  assert.ok(error instanceof DomainError);
  assert.equal(error.code, 'INVALID_CARD_PAYMENT_ACCOUNTS');
  assert.equal(error.name, 'InvalidCardPaymentAccountsError');
});
