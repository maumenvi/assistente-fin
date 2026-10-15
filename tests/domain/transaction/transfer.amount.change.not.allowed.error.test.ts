import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TransferAmountChangeNotAllowedError } from '../../../src/domain/transaction/transfer.amount.change.not.allowed.error.ts';
import { DomainError } from '../../../src/domain/shared/domain.error.ts';

test('TransferAmountChangeNotAllowedError tem code estavel e e um DomainError', () => {
  const error = new TransferAmountChangeNotAllowedError();
  assert.ok(error instanceof DomainError);
  assert.equal(error.code, 'TRANSFER_AMOUNT_CHANGE_NOT_ALLOWED');
  assert.equal(error.name, 'TransferAmountChangeNotAllowedError');
});
