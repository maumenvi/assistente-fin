import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectNewCaptures } from '../../../src/app/user-notification/select.new.captures.ts';
import { type SyncOp } from '../../../src/app/sync/sync.op.ts';
import { type SyncOpResult } from '../../../src/app/sync/sync.op.result.ts';
import { type BackupPreRegistrationRecord } from '../../../src/app/shared/backup.record.schema.ts';
import { type PreRegistrationOrigin } from '../../../src/domain/pre-registration/pre.registration.origin.ts';
import { upsertAccount } from '../sync/sync.fixtures.ts';

/** Record de pre-registro de exemplo. */
function preRecord(id: string, origin: PreRegistrationOrigin, extra: Partial<BackupPreRegistrationRecord> = {}): BackupPreRegistrationRecord {
  return { kind: 'preRegistration', id, userId: 'u1', origin, needsReview: true, manualOnly: false, createdAt: '2026-10-01', ...extra };
}

/** Upsert de pre-registro (criacao por padrao). */
function upsertPre(opId: string, record: BackupPreRegistrationRecord, baseVersion: string | null = null): SyncOp {
  return { opId, entity: 'preRegistration', entityId: record.id, kind: 'upsert', baseVersion, record };
}

function applied(opId: string): SyncOpResult {
  return { opId, status: 'applied', version: 'v1' };
}

test('criacao aplicada de captura entra com valor e descricao', () => {
  const ops = [upsertPre('o1', preRecord('p1', 'nfce', { amountCents: 4290, description: 'Mercado' }))];
  assert.deepEqual(selectNewCaptures(ops, [applied('o1')]), [{ amountCents: 4290, description: 'Mercado' }]);
});

test('todas as origens de captura entram; manual e simulation nao', () => {
  const origins: PreRegistrationOrigin[] = ['wallet', 'nfce', 'receipt', 'voice', 'manual', 'simulation'];
  const ops = origins.map((origin, i) => upsertPre(`o${i}`, preRecord(`p${i}`, origin, { amountCents: 100 + i })));
  const result = selectNewCaptures(ops, ops.map((op) => applied(op.opId)));
  assert.deepEqual(result.map((c) => c.amountCents), [100, 101, 102, 103]);
});

test('sem valor/descricao vira null; descricao so de espacos vira null', () => {
  const ops = [upsertPre('o1', preRecord('p1', 'voice')), upsertPre('o2', preRecord('p2', 'wallet', { description: '   ' }))];
  assert.deepEqual(selectNewCaptures(ops, [applied('o1'), applied('o2')]), [
    { amountCents: null, description: null },
    { amountCents: null, description: null },
  ]);
});

test('duplicate, conflict e rejected ficam de fora', () => {
  const ops = [upsertPre('o1', preRecord('p1', 'nfce')), upsertPre('o2', preRecord('p2', 'nfce')), upsertPre('o3', preRecord('p3', 'nfce'))];
  const results: SyncOpResult[] = [
    { opId: 'o1', status: 'duplicate', version: 'v1' },
    { opId: 'o2', status: 'conflict', remote: { record: null, version: 'v2' } },
    { opId: 'o3', status: 'rejected', code: 'INVALID', message: 'x' },
  ];
  assert.deepEqual(selectNewCaptures(ops, results), []);
});

test('edicao (baseVersion), exclusao, outras entidades e op sem resultado ficam de fora', () => {
  const ops: SyncOp[] = [
    upsertPre('o1', preRecord('p1', 'receipt'), 'v1'),
    { opId: 'o2', entity: 'preRegistration', entityId: 'p2', kind: 'delete', baseVersion: null, record: null },
    { opId: 'o3', entity: 'transaction', entityId: 't1', kind: 'upsert', baseVersion: null, record: null },
    upsertAccount('o4', 'a1', 'Itau', null),
    upsertPre('o5', preRecord('p5', 'wallet')),
  ];
  assert.deepEqual(selectNewCaptures(ops, ['o1', 'o2', 'o3', 'o4'].map(applied)), []);
});

test('mantem a ordem das ops, nao a dos resultados', () => {
  const ops = [
    upsertPre('o1', preRecord('p1', 'nfce', { description: 'A' })),
    upsertPre('o2', preRecord('p2', 'voice', { description: 'B' })),
  ];
  const result = selectNewCaptures(ops, [applied('o2'), applied('o1')]);
  assert.deepEqual(result.map((c) => c.description), ['A', 'B']);
});
