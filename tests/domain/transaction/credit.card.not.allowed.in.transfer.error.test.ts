import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreditCardNotAllowedInTransferError } from '../../../src/domain/transaction/credit.card.not.allowed.in.transfer.error.ts';
import { DomainError } from '../../../src/domain/shared/domain.error.ts';

test('CreditCardNotAllowedInTransferError tem code estavel e e um DomainError', () => {
  const error = new CreditCardNotAllowedInTransferError();
  assert.ok(error instanceof DomainError);
  assert.equal(error.code, 'CREDIT_CARD_NOT_ALLOWED_IN_TRANSFER');
  assert.equal(error.name, 'CreditCardNotAllowedInTransferError');
});
