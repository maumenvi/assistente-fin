import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AmbiguousTransferCategoryError } from '../../../src/domain/category/ambiguous.transfer.category.error.ts';
import { DomainError } from '../../../src/domain/shared/domain.error.ts';

test('AmbiguousTransferCategoryError tem code estavel, e um DomainError e carrega o diagnostico', () => {
  const candidates = [
    { categoryId: 'c1', name: 'TRANSFERÊNCIAS', transactionCount: 3 },
    { categoryId: 'c2', name: 'TRANSFERÊNCIAS', transactionCount: 0 },
  ];
  const error = new AmbiguousTransferCategoryError(candidates);
  assert.ok(error instanceof DomainError);
  assert.equal(error.code, 'AMBIGUOUS_TRANSFER_CATEGORY');
  assert.equal(error.name, 'AmbiguousTransferCategoryError');
  assert.deepEqual(error.candidates, candidates);
});
