import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateIncomeInputSchema } from '../../../src/app/income/update.income.input.schema.ts';

const base = { id: 'i1', userId: 'u1' };

test('accountId ausente nao mexe no vinculo atual', () => {
  const parsed = updateIncomeInputSchema.safeParse(base);
  assert.ok(parsed.success);
  assert.equal(parsed.data?.accountId, undefined);
});

test('accountId com string valida e aceito e normalizado (trim)', () => {
  const parsed = updateIncomeInputSchema.safeParse({ ...base, accountId: '  acc1  ' });
  assert.ok(parsed.success);
  assert.equal(parsed.data?.accountId, 'acc1');
});

test('accountId: null explicito e aceito - desvincula (spec 012, decisao 9)', () => {
  const parsed = updateIncomeInputSchema.safeParse({ ...base, accountId: null });
  assert.ok(parsed.success);
  assert.equal(parsed.data?.accountId, null);
});

test('accountId em branco e recusado', () => {
  const parsed = updateIncomeInputSchema.safeParse({ ...base, accountId: '   ' });
  assert.equal(parsed.success, false);
});
