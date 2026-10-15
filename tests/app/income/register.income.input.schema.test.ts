import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerIncomeInputSchema } from '../../../src/app/income/register.income.input.schema.ts';

const base = {
  userId: 'u1',
  date: '2026-01-05T00:00:00.000Z',
  amountCents: 500_000,
  source: 'Salario',
  recurrence: { frequency: 'nao-repete' },
};

test('accountId e opcional (spec 012, RF-4)', () => {
  const parsed = registerIncomeInputSchema.safeParse(base);
  assert.ok(parsed.success);
  assert.equal(parsed.data?.accountId, undefined);
});

test('accountId valido e aceito e normalizado (trim)', () => {
  const parsed = registerIncomeInputSchema.safeParse({ ...base, accountId: '  acc1  ' });
  assert.ok(parsed.success);
  assert.equal(parsed.data?.accountId, 'acc1');
});

test('accountId em branco e recusado', () => {
  const parsed = registerIncomeInputSchema.safeParse({ ...base, accountId: '   ' });
  assert.equal(parsed.success, false);
});
