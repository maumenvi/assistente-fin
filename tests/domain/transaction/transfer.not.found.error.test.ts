import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TransferNotFoundError } from '../../../src/domain/transaction/transfer.not.found.error.ts';
import { DomainError } from '../../../src/domain/shared/domain.error.ts';

test('TransferNotFoundError tem code estavel e e um DomainError', () => {
  const error = new TransferNotFoundError();
  assert.ok(error instanceof DomainError);
  assert.equal(error.code, 'TRANSFER_NOT_FOUND');
  assert.equal(error.name, 'TransferNotFoundError');
});
