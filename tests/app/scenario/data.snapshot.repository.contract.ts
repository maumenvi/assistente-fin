import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type DataSnapshotRepository } from '../../../src/app/scenario/data.snapshot.repository.port.ts';
import { DataSnapshot } from '../../../src/domain/scenario/data.snapshot.entity.ts';

const snapshot = (id: string, userId: string, takenAtIso: string): DataSnapshot =>
  DataSnapshot.create({
    id,
    userId,
    originScenarioId: 'scn1',
    takenAt: new Date(takenAtIso),
    recordCounts: { account: 1, income: 2 },
    payload: '{"kind":"header"}\n',
  });

/**
 * Suite de contrato do `DataSnapshotRepository` (spec 002, RF-37, RF-40a).
 */
export function runDataSnapshotRepositoryContract(
  label: string,
  createRepository: () => DataSnapshotRepository,
): void {
  test(`${label}: save + findById dentro do escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(snapshot('snap1', 'u1', '2026-03-01T12:00:00.000Z'));

    const found = await repo.findById('u1', 'snap1');
    assert.equal(found?.originScenarioId, 'scn1');
    assert.deepEqual(found?.recordCounts, { account: 1, income: 2 });
    assert.equal(found?.payload, '{"kind":"header"}\n');
    assert.equal(await repo.findById('u2', 'snap1'), null);
  });

  test(`${label}: listByUser filtra por usuario e ordena do mais recente pro mais antigo`, async () => {
    const repo = createRepository();
    await repo.save(snapshot('snap1', 'u1', '2026-01-01T00:00:00.000Z'));
    await repo.save(snapshot('snap2', 'u1', '2026-03-01T00:00:00.000Z'));
    await repo.save(snapshot('snap3', 'u2', '2026-02-01T00:00:00.000Z'));

    const ids = (await repo.listByUser('u1')).map((s) => s.id);
    assert.deepEqual(ids, ['snap2', 'snap1']);
  });

  test(`${label}: delete respeita o escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(snapshot('snap1', 'u1', '2026-03-01T12:00:00.000Z'));

    await repo.delete('u2', 'snap1');
    assert.ok(await repo.findById('u1', 'snap1'), 'nao remove snapshot de outro usuario');

    await repo.delete('u1', 'snap1');
    assert.equal(await repo.findById('u1', 'snap1'), null);
    await repo.delete('u1', 'snap1'); // idempotente
  });
}
