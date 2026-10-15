import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupRecordSchema } from '../../../src/app/shared/backup.record.schema.ts';

const baseIncome = {
  kind: 'income' as const,
  id: 'income-1',
  userId: 'u1',
  date: '2026-01-05T00:00:00.000Z',
  amountCents: 500_000,
  currency: 'BRL' as const,
  source: 'Salario',
  recurrenceFrequency: 'nao-repete' as const,
  recurrenceEveryN: 1,
  recurrenceEndDate: null,
  categoryId: 'cat-1',
};

const baseTransaction = {
  kind: 'transaction' as const,
  id: 'tx-1',
  userId: 'u1',
  date: '2026-01-05T00:00:00.000Z',
  amountCents: 5_000,
  currency: 'BRL' as const,
  type: 'expense' as const,
  categoryId: 'cat-1',
  accountId: 'acc-1',
};

test('record income no formato antigo (sem accountId) continua parseando (spec 012, aditivo)', () => {
  const result = backupRecordSchema.safeParse(baseIncome);
  assert.ok(result.success);
  assert.equal(result.data && 'accountId' in result.data ? result.data.accountId : undefined, undefined);
});

test('record income com accountId novo parseia e preserva o valor', () => {
  const result = backupRecordSchema.safeParse({ ...baseIncome, accountId: 'acc-1' });
  assert.ok(result.success);
  assert.equal(result.data && 'accountId' in result.data ? result.data.accountId : undefined, 'acc-1');
});

test('record income com accountId vazio e recusado', () => {
  const result = backupRecordSchema.safeParse({ ...baseIncome, accountId: '   ' });
  assert.equal(result.success, false);
});

test('record transaction no formato antigo (sem incomeId) continua parseando (spec 012, aditivo)', () => {
  const result = backupRecordSchema.safeParse(baseTransaction);
  assert.ok(result.success);
  assert.equal(result.data && 'incomeId' in result.data ? result.data.incomeId : undefined, undefined);
});

test('record transaction com incomeId novo parseia e preserva o valor', () => {
  const result = backupRecordSchema.safeParse({ ...baseTransaction, incomeId: 'income-1' });
  assert.ok(result.success);
  assert.equal(result.data && 'incomeId' in result.data ? result.data.incomeId : undefined, 'income-1');
});

test('record transaction com incomeId vazio e recusado', () => {
  const result = backupRecordSchema.safeParse({ ...baseTransaction, incomeId: '   ' });
  assert.equal(result.success, false);
});
