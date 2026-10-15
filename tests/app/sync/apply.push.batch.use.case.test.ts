import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApplyPushBatchUseCase } from '../../../src/app/sync/apply.push.batch.use.case.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { FakeSyncHubUnitOfWork } from '../../../src/database/fake/sync.hub.unit.of.work.fake.ts';
import { FixedClock } from '../../support/fixed.clock.ts';
import { account, deleteAccount, upsertAccount } from './sync.fixtures.ts';

function setup() {
  const db = new FakeDatabase();
  const uow = new FakeSyncHubUnitOfWork(db);
  return { db, uow, push: new ApplyPushBatchUseCase(uow, new FixedClock(new Date('2026-09-24T12:00:00Z'))) };
}
const run = (push: ApplyPushBatchUseCase, ops: unknown[], deviceId = 'cel-1') => push.execute({ userId: 'u1', deviceId, ops });

test('regra 3: aplica criacao e devolve a versao do hub', async () => {
  const { db, push } = setup();
  const [result] = await run(push, [upsertAccount('op1', 'a1', 'Itau', null)]);
  assert.equal(result?.status, 'applied');
  assert.equal((await db.accounts.findById('u1', 'a1'))?.name, 'Itau');
  assert.ok(result?.status === 'applied' && result.version !== null);
});

test('regra 1: reenviar o mesmo opId nao reaplica (idempotente, FR-010)', async () => {
  const { db, push } = setup();
  await run(push, [upsertAccount('op1', 'a1', 'Itau', null)]);
  const before = await db.accounts.findById('u1', 'a1');
  const [again] = await run(push, [upsertAccount('op1', 'a1', 'Itau', null)]);
  assert.equal(again?.status, 'duplicate');
  assert.equal((await db.accounts.findById('u1', 'a1'))?.updatedAt?.getTime(), before?.updatedAt?.getTime());
});

test('regra 2: alterado no desktop desde a versao-base -> conflito, nada gravado', async () => {
  const { db, push } = setup();
  const [created] = await run(push, [upsertAccount('op1', 'a1', 'Itau', null)]);
  const base = created?.status === 'applied' ? created.version : null;
  const onDesktop = await db.accounts.findById('u1', 'a1');
  assert.ok(onDesktop);
  await db.accounts.save(onDesktop.rename('Itau Desktop'));
  const [result] = await run(push, [upsertAccount('op2', 'a1', 'Itau Celular', base)]);
  assert.equal(result?.status, 'conflict');
  assert.equal((await db.accounts.findById('u1', 'a1'))?.name, 'Itau Desktop');
});

test('regra 2: edicoes sequenciais do MESMO aparelho nao sao conflito', async () => {
  const { db, push } = setup();
  const [created] = await run(push, [upsertAccount('op1', 'a1', 'Itau', null)]);
  const base = created?.status === 'applied' ? created.version : null;
  const results = await run(push, [upsertAccount('op2', 'a1', 'Itau 2', base), upsertAccount('op3', 'a1', 'Itau 3', base)]);
  assert.deepEqual(results.map((r) => r.status), ['applied', 'applied']);
  assert.equal((await db.accounts.findById('u1', 'a1'))?.name, 'Itau 3');
});

test('M1: conteudo identico ao atual nao e conflito', async () => {
  const { db, push } = setup();
  await db.accounts.save(account('a1', 'Itau'));
  const [result] = await run(push, [upsertAccount('op1', 'a1', 'Itau', null)]);
  assert.equal(result?.status, 'duplicate');
});

test('regra 4: excluir o que nao existe e aplicado; excluir existente remove', async () => {
  const { db, push } = setup();
  assert.equal((await run(push, [deleteAccount('d0', 'nada', null)]))[0]?.status, 'applied');
  const [created] = await run(push, [upsertAccount('op1', 'a1', 'Itau', null)]);
  const base = created?.status === 'applied' ? created.version : null;
  assert.equal((await run(push, [deleteAccount('d1', 'a1', base)]))[0]?.status, 'applied');
  assert.equal(await db.accounts.findById('u1', 'a1'), null);
});

test('regra 5: record de outro usuario ou incoerente -> rejected; entidade sem exclusao -> UNSUPPORTED', async () => {
  const { push } = setup();
  const [foreign] = await run(push, [upsertAccount('op1', 'a1', 'X', null, 'outro')]);
  assert.ok(foreign?.status === 'rejected' && foreign.code === 'INVALID_RECORD');
  const { db, push: push2 } = setup();
  const { Category } = await import('../../../src/domain/category/category.entity.ts');
  const { CategoryName } = await import('../../../src/domain/category/category.name.value.object.ts');
  await db.categories.save(Category.create({ id: 'c1', userId: 'u1', name: CategoryName.create('X') }));
  const [unsupported] = await run(push2, [{ opId: 'd', entity: 'category', entityId: 'c1', kind: 'delete', baseVersion: null, record: null }]);
  assert.ok(unsupported?.status === 'rejected' && unsupported.code === 'UNSUPPORTED');
});

test('regra 6: mesmo opId em dois pedidos simultaneos -> o segundo devolve o resultado do primeiro, nao recusa', async () => {
  const db = new FakeDatabase();
  const inner = new FakeSyncHubUnitOfWork(db);
  const concurrent = new ApplyPushBatchUseCase(inner, new FixedClock(new Date('2026-09-24T12:00:00Z')));
  // o "outro pedido" aplica op1 primeiro...
  const [first] = await run(concurrent, [upsertAccount('op1', 'a1', 'Itau', null)]);
  assert.equal(first?.status, 'applied');
  // ...e este pedido tinha lido "op1 nao existe" antes do commit dele: a gravacao bate na chave
  let staleRead = true;
  const racing = {
    run: <T>(work: Parameters<FakeSyncHubUnitOfWork['run']>[0]) =>
      inner.run((tx, applied) =>
        work(tx, {
          find: async (opId: string) => {
            if (staleRead) {
              staleRead = false;
              return null;
            }
            return applied.find(opId);
          },
          save: async () => {
            throw Object.assign(new Error('Unique constraint failed on the constraint: `sync_applied_ops_pkey`'), { code: 'P2002' });
          },
          producedBy: (...args: Parameters<typeof applied.producedBy>) => applied.producedBy(...args),
        }) as Promise<T>,
      ),
  };
  const push = new ApplyPushBatchUseCase(racing, new FixedClock(new Date('2026-09-24T12:00:00Z')));
  const [second] = await run(push, [upsertAccount('op1', 'a1', 'Itau', null)]);
  assert.equal(second?.status, 'duplicate');
  assert.ok(second?.status === 'duplicate' && first?.status === 'applied' && second.version === first.version);
});
