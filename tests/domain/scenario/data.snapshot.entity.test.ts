import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DataSnapshot } from '../../../src/domain/scenario/data.snapshot.entity.ts';
import { InvalidDataSnapshotError } from '../../../src/domain/scenario/invalid.data.snapshot.error.ts';

const base = () => ({
  id: '  snap-1  ',
  userId: '  user-1  ',
  originScenarioId: '  scn-1  ',
  takenAt: new Date('2026-03-01T12:00:00.000Z'),
  recordCounts: { account: 2, income: 5 },
  payload: '{"kind":"header"}\n{"kind":"account"}\n',
});

test('cria e normaliza os ids', () => {
  const snapshot = DataSnapshot.create(base());
  assert.equal(snapshot.id, 'snap-1');
  assert.equal(snapshot.userId, 'user-1');
  assert.equal(snapshot.originScenarioId, 'scn-1');
  assert.deepEqual(snapshot.recordCounts, { account: 2, income: 5 });
});

test('originScenarioId null e aceito; string vazia nao', () => {
  assert.equal(DataSnapshot.create({ ...base(), originScenarioId: null }).originScenarioId, null);
  assert.throws(
    () => DataSnapshot.create({ ...base(), originScenarioId: '   ' }),
    InvalidDataSnapshotError,
  );
});

test('takenAt invalido e rejeitado', () => {
  assert.throws(
    () => DataSnapshot.create({ ...base(), takenAt: new Date('nao-e-data') }),
    InvalidDataSnapshotError,
  );
});

test('payload vazio e rejeitado', () => {
  assert.throws(() => DataSnapshot.create({ ...base(), payload: '   ' }), InvalidDataSnapshotError);
});

test('recordCounts com valor negativo ou fracionado e rejeitado', () => {
  assert.throws(
    () => DataSnapshot.create({ ...base(), recordCounts: { account: -1 } }),
    InvalidDataSnapshotError,
  );
  assert.throws(
    () => DataSnapshot.create({ ...base(), recordCounts: { account: 1.5 } }),
    InvalidDataSnapshotError,
  );
});

test('recordCounts e copiado (imutabilidade)', () => {
  const input = base();
  const snapshot = DataSnapshot.create(input);
  input.recordCounts.account = 99;
  assert.equal(snapshot.recordCounts['account'], 2);
});
