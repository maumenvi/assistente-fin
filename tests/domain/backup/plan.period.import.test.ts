import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPeriodImport } from '../../../src/domain/backup/plan.period.import.ts';
import { resolvePeriodImport } from '../../../src/domain/backup/resolve.period.import.ts';
import { UnresolvedImportConflictError } from '../../../src/domain/backup/unresolved.import.conflict.error.ts';
import { type PortableRecord } from '../../../src/domain/backup/portable.record.ts';

/** Plano e decisoes da importacao (spec 022, T139; FR-018). */
const existing: PortableRecord[] = [
  { kind: 'account', id: 'a1', name: 'Itau' },
  { kind: 'category', id: 'c1', name: 'Mercado' },
  { kind: 'transaction', id: 't1', amountCents: 100, accountId: 'a1', categoryId: 'c1' },
  { kind: 'transaction', id: 'p1', amountCents: 500, installmentGroupId: 'g1', accountId: 'a1', categoryId: 'c1' },
  { kind: 'transaction', id: 'p2', amountCents: 500, installmentGroupId: 'g1', accountId: 'a1', categoryId: 'c1' },
];
const incoming: PortableRecord[] = [
  { kind: 'header', schemaVersion: 3 },
  { kind: 'account', id: 'a1', name: 'Itau', updatedAt: '2026-01-01' },
  { kind: 'category', id: 'c1', name: 'Mercado (novo)' },
  { kind: 'transaction', id: 't1', amountCents: 999, accountId: 'a1', categoryId: 'c1' },
  { kind: 'transaction', id: 't2', amountCents: 50, accountId: 'a1', categoryId: 'c1' },
  { kind: 'transaction', id: 'p1', amountCents: 600, installmentGroupId: 'g1', accountId: 'a1', categoryId: 'c1' },
  { kind: 'transaction', id: 'p2', amountCents: 500, installmentGroupId: 'g1', accountId: 'a1', categoryId: 'c1' },
];

let n = 0;
const newId = () => `new-${String((n += 1))}`;

test('classifica new, identical (ignorando updatedAt) e conflict', () => {
  const plan = planPeriodImport(existing, incoming);
  assert.deepEqual([...plan.newIds], ['transaction:t2']);
  assert.deepEqual([...plan.identicalIds], ['account:a1', 'transaction:p2']);
  assert.deepEqual(plan.conflicts.map((c) => c.conflictId), ['category:c1', 'transaction:t1', 'transaction:p1']);
});

test('decisao faltando sem padrao -> UnresolvedImportConflictError', () => {
  const plan = planPeriodImport(existing, incoming);
  assert.throws(
    () => resolvePeriodImport(plan, { 'category:c1': 'replace' }, undefined, newId),
    (error: unknown) => error instanceof UnresolvedImportConflictError && error.conflictIds.length === 2,
  );
});

test('keep-current pula, replace grava por cima, new sempre entra', () => {
  const plan = planPeriodImport(existing, incoming);
  const writes = resolvePeriodImport(plan, { 'category:c1': 'keep-current', 'transaction:t1': 'replace' }, 'keep-current', newId);
  assert.deepEqual(writes.map((w) => [w.id, w['amountCents']]), [['t1', 999], ['t2', 50]]);
});

test('keep-both numa parcela copia o grupo inteiro com ids e grupo novos', () => {
  n = 0;
  const plan = planPeriodImport(existing, incoming);
  const writes = resolvePeriodImport(plan, { 'transaction:p1': 'keep-both' }, 'keep-current', newId);
  const copies = writes.filter((w) => w['installmentGroupId'] !== undefined);
  assert.equal(copies.length, 2, 'as duas parcelas, mesmo a identica');
  const group = copies[0]!['installmentGroupId'];
  assert.notEqual(group, 'g1');
  assert.ok(copies.every((c) => c['installmentGroupId'] === group && c.id !== 'p1' && c.id !== 'p2'));
  assert.ok(writes.some((w) => w.id === 't2'), 'o novo continua entrando');
});

test('keep-both numa categoria: copia com nome marcado e remapeia quem aponta para ela no arquivo', () => {
  n = 0;
  const plan = planPeriodImport(existing, incoming);
  const writes = resolvePeriodImport(plan, { 'category:c1': 'keep-both' }, 'keep-current', newId);
  const copy = writes.find((w) => w.kind === 'category');
  assert.equal(copy?.['name'], 'Mercado (novo) (importada)');
  assert.notEqual(copy?.id, 'c1');
  assert.equal(writes.find((w) => w.id === 't2')?.['categoryId'], copy?.id);
});
