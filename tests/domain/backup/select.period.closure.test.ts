import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectPeriodClosure } from '../../../src/domain/backup/select.period.closure.ts';
import { type PortableRecord } from '../../../src/domain/backup/portable.record.ts';

/** Fecho do backup por periodo (spec 022, T138; FR-016/FR-017). */
const d = (day: string) => `${day}T12:00:00.000Z`;
const RECORDS: PortableRecord[] = [
  { kind: 'account', id: 'acc-itau' },
  { kind: 'account', id: 'acc-iti' },
  { kind: 'account', id: 'acc-nao' },
  { kind: 'category', id: 'cat-mercado' },
  { kind: 'category', id: 'cat-salario' },
  { kind: 'category', id: 'cat-nao' },
  { kind: 'income', id: 'inc-1', categoryId: 'cat-salario', accountId: 'acc-itau' },
  { kind: 'income', id: 'inc-nao', categoryId: 'cat-nao' },
  { kind: 'fixedExpense', id: 'fe-1', categoryId: 'cat-mercado', accountId: 'acc-itau' },
  { kind: 'spendingLimitPlan', id: 'plan-1', categoryId: 'cat-mercado' },
  { kind: 'spendingLimit', id: 'lim-set', categoryId: 'cat-mercado', period: { year: 2026, month: 9 }, definitionId: 'plan-1' },
  { kind: 'spendingLimit', id: 'lim-jul', categoryId: 'cat-nao', period: { year: 2026, month: 7 } },
  { kind: 'transactionSeries', id: 'ser-1', categoryId: 'cat-mercado', accountId: 'acc-itau' },
  { kind: 'transaction', id: 't-in', date: d('2026-09-10'), categoryId: 'cat-mercado', accountId: 'acc-itau' },
  { kind: 'transaction', id: 't-out', date: d('2026-10-10'), categoryId: 'cat-nao', accountId: 'acc-nao' },
  { kind: 'transaction', id: 'p1', date: d('2026-09-12'), categoryId: 'cat-mercado', accountId: 'acc-iti', installmentGroupId: 'g1' },
  { kind: 'transaction', id: 'p2', date: d('2026-10-12'), categoryId: 'cat-mercado', accountId: 'acc-iti', installmentGroupId: 'g1' },
  { kind: 'transaction', id: 's1', date: d('2026-08-05'), categoryId: 'cat-mercado', accountId: 'acc-itau', seriesId: 'ser-1' },
  { kind: 'transaction', id: 's2', date: d('2026-09-05'), categoryId: 'cat-mercado', accountId: 'acc-itau', seriesId: 'ser-1' },
  { kind: 'transaction', id: 'sal', date: d('2026-09-05'), categoryId: 'cat-salario', accountId: 'acc-itau', incomeId: 'inc-1' },
  { kind: 'transaction', id: 'fx', date: d('2026-09-10'), categoryId: 'cat-mercado', accountId: 'acc-itau', fixedExpenseId: 'fe-1' },
  { kind: 'preRegistration', id: 'pre-in', date: d('2026-09-20'), createdAt: d('2026-09-20') },
  { kind: 'preRegistration', id: 'pre-nodate', createdAt: d('2026-09-21') },
  { kind: 'preRegistration', id: 'pre-out', date: d('2026-10-01'), createdAt: d('2026-09-21') },
  { kind: 'captureAttachment', id: 'att-1', preRegistrationId: 'pre-in' },
  { kind: 'captureAttachment', id: 'att-2', preRegistrationId: 'pre-out' },
];

test('lancamentos do periodo + grupos inteiros + referenciados + pre-registros do periodo', () => {
  const ids = selectPeriodClosure(RECORDS, { from: '2026-09-01', to: '2026-09-30' }).map((r) => r.id);
  assert.deepEqual(ids, [
    'acc-itau', 'acc-iti', 'cat-mercado', 'cat-salario',
    'inc-1', 'fe-1', 'plan-1', 'lim-set', 'ser-1',
    't-in', 'p1', 'p2', 's1', 's2', 'sal', 'fx',
    'pre-in', 'pre-nodate', 'att-1',
  ]);
});

test('periodo vazio -> nada (so os limites do mes, se houver)', () => {
  assert.deepEqual(selectPeriodClosure(RECORDS, { from: '2025-01-01', to: '2025-01-31' }), []);
});
