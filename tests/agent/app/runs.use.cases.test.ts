import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DeleteAllRunsUseCase } from '../../../src/app/agent/use-cases/delete.all.runs.use.case.ts';
import { GetRunDetailUseCase } from '../../../src/app/agent/use-cases/get.run.detail.use.case.ts';
import { ListRunsUseCase } from '../../../src/app/agent/use-cases/list.runs.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { FakeAgentStore } from '../../../src/database/fake/agent.store.fake.ts';
import { at, makeConversation, makeRun, makeStep } from '../store/support/agent.fixtures.ts';

async function setup() {
  const store = new FakeAgentStore();
  await store.conversations.create(makeConversation('c1', 'u1'));
  await store.conversations.create(makeConversation('c2', 'u2'));
  const consumed = (ms: number, cost: number | null) => ({ steps: 2, ms, inputTokens: 100, outputTokens: 20, cachedTokens: 0, costMicroUsd: cost });
  await store.runs.create(makeRun('r1', 'c1', 'u1', { startedAt: at(1), status: 'done', model: 'm-a', consumed: consumed(1000, 400) }));
  await store.runs.create(makeRun('r2', 'c1', 'u1', { startedAt: at(2), status: 'failed', model: 'm-b', consumed: consumed(500, 100) }));
  await store.runs.create(makeRun('r3', 'c1', 'u1', { startedAt: at(3), status: 'done', model: 'm-a', consumed: consumed(300, null) }));
  await store.runs.create(makeRun('x1', 'c2', 'u2', { startedAt: at(2) }));
  return { store, list: new ListRunsUseCase(store), detail: new GetRunDetailUseCase(store), delAll: new DeleteAllRunsUseCase(store) };
}

describe('execucoes (US4)', () => {
  it('lista mais recentes primeiro, com filtros de status e modelo e totais; isolada por usuario', async () => {
    const t = await setup();
    const all = await t.list.execute({ userId: 'u1' });
    assert.deepEqual(all.runs.map((r) => r.id), ['r3', 'r2', 'r1']);
    assert.equal(all.totals.count, 3);
    assert.equal(all.totals.ms, 1800);
    assert.equal(all.totals.inputTokens, 300);
    assert.equal(all.totals.costMicroUsd, null, 'custo desconhecido em alguma run');
    assert.deepEqual((await t.list.execute({ userId: 'u1', status: 'failed' })).runs.map((r) => r.id), ['r2']);
    const byModel = await t.list.execute({ userId: 'u1', model: 'm-a' });
    assert.deepEqual(byModel.runs.map((r) => r.id), ['r3', 'r1']);
    assert.deepEqual((await t.list.execute({ userId: 'u2' })).runs.map((r) => r.id), ['x1']);
    assert.equal((await t.list.execute({ userId: 'u1', model: 'm-b' })).totals.costMicroUsd, 100);
  });

  it('paginacao por cursor e entrada invalida', async () => {
    const t = await setup();
    const first = await t.list.execute({ userId: 'u1', limit: 2 });
    assert.deepEqual(first.runs.map((r) => r.id), ['r3', 'r2']);
    assert.equal(first.next, at(2));
    const second = await t.list.execute({ userId: 'u1', limit: 2, ...(first.next === null ? {} : { before: first.next }) });
    assert.deepEqual(second.runs.map((r) => r.id), ['r1']);
    assert.equal(second.next, null);
    await assert.rejects(t.list.execute({ userId: 'u1', limit: 51 }), InvalidInputError);
    await assert.rejects(t.list.execute({ userId: 'u1', status: 'qualquer' }), InvalidInputError);
  });

  it('detalhe: passos em ordem, sem o checkpoint; outro usuario nao ve', async () => {
    const t = await setup();
    await t.store.steps.appendMany('u1', [makeStep('r1', 3), makeStep('r1', 1), makeStep('r1', 2, { truncated: true })]);
    const detail = await t.detail.execute({ userId: 'u1', runId: 'r1' });
    assert.deepEqual(detail?.steps.map((s) => s.seq), [1, 2, 3]);
    assert.equal(detail?.steps[1]?.truncated, true);
    assert.ok(!('state' in (detail?.run ?? {})));
    assert.equal(await t.detail.execute({ userId: 'u2', runId: 'r1' }), null);
    assert.equal(await t.detail.execute({ userId: 'u1', runId: 'nao-existe' }), null);
  });

  it('apagar o historico remove execucoes e passos so do usuario', async () => {
    const t = await setup();
    await t.store.steps.appendMany('u1', [makeStep('r1', 1)]);
    await t.delAll.execute({ userId: 'u1' });
    assert.deepEqual((await t.list.execute({ userId: 'u1' })).runs, []);
    assert.deepEqual(await t.store.steps.list('u1', 'r1'), []);
    assert.equal((await t.list.execute({ userId: 'u2' })).runs.length, 1);
    await assert.rejects(t.delAll.execute({}), InvalidInputError);
  });
});
