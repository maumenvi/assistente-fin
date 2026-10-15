import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchIncomeMonthInputSchema } from '../../../src/app/income/launch.income.month.input.schema.ts';

const base = {
  userId: 'u1',
  incomeId: 'income-1',
  month: { year: 2026, month: 3 },
};

test('entrada valida e aceita', () => {
  const parsed = launchIncomeMonthInputSchema.safeParse(base);
  assert.ok(parsed.success);
  assert.deepEqual(parsed.data, base);
});

test('userId ausente/vazio e recusado', () => {
  assert.equal(launchIncomeMonthInputSchema.safeParse({ ...base, userId: '' }).success, false);
  const { userId: _userId, ...semUserId } = base;
  assert.equal(launchIncomeMonthInputSchema.safeParse(semUserId).success, false);
});

test('incomeId ausente/vazio e recusado', () => {
  assert.equal(launchIncomeMonthInputSchema.safeParse({ ...base, incomeId: '' }).success, false);
  const { incomeId: _incomeId, ...semIncomeId } = base;
  assert.equal(launchIncomeMonthInputSchema.safeParse(semIncomeId).success, false);
});

test('month ausente e recusado', () => {
  const { month: _month, ...semMonth } = base;
  assert.equal(launchIncomeMonthInputSchema.safeParse(semMonth).success, false);
});

test('month.month fora de 1..12 e recusado', () => {
  assert.equal(
    launchIncomeMonthInputSchema.safeParse({ ...base, month: { year: 2026, month: 0 } }).success,
    false,
  );
  assert.equal(
    launchIncomeMonthInputSchema.safeParse({ ...base, month: { year: 2026, month: 13 } }).success,
    false,
  );
});

test('month.year abaixo de 1970 e recusado', () => {
  assert.equal(
    launchIncomeMonthInputSchema.safeParse({ ...base, month: { year: 1969, month: 1 } }).success,
    false,
  );
});
