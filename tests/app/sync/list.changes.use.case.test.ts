import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ListChangesUseCase } from '../../../src/app/sync/list.changes.use.case.ts';
import { streamSyncSnapshot } from '../../../src/app/sync/stream.sync.snapshot.use.case.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { FakeSyncChangeRepository } from '../../../src/database/fake/sync.change.repository.fake.ts';
import { account } from './sync.fixtures.ts';

async function setup() {
  const db = new FakeDatabase();
  const log = new FakeSyncChangeRepository();
  await db.accounts.save(account('a1', 'Itau'));
  log.record('u1', 'account', 'a1', 'upsert');
  await db.accounts.save(account('a2', 'Nubank'));
  log.record('u1', 'account', 'a2', 'upsert');
  log.record('u1', 'account', 'a1', 'upsert');
  log.record('u1', 'account', 'sumiu', 'upsert');
  log.record('u1', 'account', 'sumiu', 'delete');
  log.record('u1', 'projectionScenario', 's1', 'upsert');
  log.record('u2', 'account', 'x', 'upsert');
  return { db, log, useCase: new ListChangesUseCase(db, log) };
}

test('colapsa por registro, devolve o estado atual e tombstone; ignora o que nao sincroniza', async () => {
  const { useCase } = await setup();
  const page = await useCase.execute({ userId: 'u1', since: 0, limit: 100 });
  assert.deepEqual(page.changes.map((c) => [c.entityId, c.kind, c.seq]), [
    ['a2', 'upsert', 2],
    ['a1', 'upsert', 3],
    ['sumiu', 'delete', 5],
  ]);
  assert.equal(page.changes[1]?.record?.kind, 'account');
  assert.ok(page.changes[1]?.version);
  assert.equal(page.hasMore, false);
  assert.equal(page.nextSince, 6);
});

test('since/limit paginam e sinalizam hasMore', async () => {
  const { useCase } = await setup();
  const first = await useCase.execute({ userId: 'u1', since: 0, limit: 2 });
  assert.equal(first.hasMore, true);
  assert.equal(first.nextSince, 2);
  const rest = await useCase.execute({ userId: 'u1', since: first.nextSince, limit: 100 });
  assert.deepEqual(rest.changes.map((c) => c.entityId), ['a1', 'sumiu']);
});

test('snapshot: registros pais antes de filhos e cursor no fim', async () => {
  const { db, log } = await setup();
  const lines = [];
  for await (const line of streamSyncSnapshot(db, log, 'u1')) lines.push(line);
  assert.equal(lines.at(-1)?.kind, 'cursor');
  assert.deepEqual(lines.filter((l) => l.kind === 'row').map((l) => (l.kind === 'row' ? l.entityId : '')).sort(), ['a1', 'a2']);
});
