import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IncomeMonthAlreadyLaunchedError } from '../../../src/domain/income/income.month.already.launched.error.ts';
import { DomainError } from '../../../src/domain/shared/domain.error.ts';

test('IncomeMonthAlreadyLaunchedError tem code estavel e e um DomainError', () => {
  const error = new IncomeMonthAlreadyLaunchedError();
  assert.ok(error instanceof DomainError);
  assert.equal(error.code, 'INCOME_MONTH_ALREADY_LAUNCHED');
  assert.equal(error.name, 'IncomeMonthAlreadyLaunchedError');
});
