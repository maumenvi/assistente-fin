import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IncomeWithoutAccountError } from '../../../src/domain/income/income.without.account.error.ts';
import { DomainError } from '../../../src/domain/shared/domain.error.ts';

test('IncomeWithoutAccountError tem code estavel e e um DomainError', () => {
  const error = new IncomeWithoutAccountError();
  assert.ok(error instanceof DomainError);
  assert.equal(error.code, 'INCOME_WITHOUT_ACCOUNT');
  assert.equal(error.name, 'IncomeWithoutAccountError');
});
