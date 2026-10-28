import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RecoverRunsUseCase } from '../../../src/app/agent/use-cases/recover.runs.use.case.ts';
import { MemoryAgentSettings } from '../../../src/app/agent/settings/memory.agent.settings.ts';
import { MemorySecretStore } from '../../../src/app/agent/settings/memory.secret.store.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { DEFAULT_RUN_BUDGET } from '../../../src/domain/agent/default.run.budget.ts';
import { FakeAgentStore } from '../../../src/database/fake/agent.store.fake.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { makeConversation, makeNewMessage, makeRun } from '../store/support/agent.fixtures.ts';

const NOW = new Date('2026-10-22T12:00:00.000Z');
const ago = (seconds: number): string => new Date(NOW.getTime() - seconds * 1000).toISOString();

async function setup(maxMs = DEFAULT_RUN_BUDGET.maxMs) {
  const store = new FakeAgentStore();
  const settings = new MemoryAgentSettings(new MemorySecretStore());
  await settings.write('u1', { profiles: [], localOnly: false, limits: { ...DEFAULT_RUN_BUDGET, maxMs } });
  await store.conversations.create(makeConversation('c1', 'u1'));
  await store.conversations.create(makeConversation('c2', 'u2'));
  const recover = new RecoverRunsUseCase(store, settings, new MutableClock(NOW));
  return { store, recover };
}

async function seedRun(store: FakeAgentStore, id: string, userId: string, conversationId: string, heartbeatSecondsAgo: number): Promise<void> {
  await store.messages.append(makeNewMessage(`${id}-a`, conversationId, userId, { role: 'assistant', status: 'streaming', runId: id, parts: [{ type: 'text', text: 'Parcial' }] }));
  await store.runs.create(makeRun(id, conversationId, userId, { assistantMessageId: `${id}-a`, heartbeatAt: ago(heartbeatSecondsAgo) }));
}

describe('RecoverRunsUseCase', () => {
  it('execucao recente nao e tocada; a antiga vira interrompida junto com a mensagem, mantendo o parcial', async () => {
    const t = await setup();
    await seedRun(t.store, 'recente', 'u1', 'c1', 20);
    await seedRun(t.store, 'antiga', 'u1', 'c1', 600);
    assert.deepEqual(await t.recover.execute({ userId: 'u1' }), { recovered: 1 });
    assert.equal((await t.store.runs.get('u1', 'recente'))?.status, 'running');
    assert.equal((await t.store.runs.get('u1', 'antiga'))?.status, 'interrupted');
    const messages = await t.store.messages.list('u1', 'c1', { limit: 10 });
    assert.equal(messages.find((m) => m.id === 'recente-a')?.status, 'streaming');
    const old = messages.find((m) => m.id === 'antiga-a');
    assert.equal(old?.status, 'interrupted');
    assert.deepEqual(old?.parts, [{ type: 'text', text: 'Parcial' }]);
  });

  it('idempotente, isolado por usuario e sem duplicar nada', async () => {
    const t = await setup();
    await seedRun(t.store, 'antiga', 'u1', 'c1', 600);
    await seedRun(t.store, 'de-outro', 'u2', 'c2', 600);
    assert.equal((await t.recover.execute({ userId: 'u1' })).recovered, 1);
    assert.equal((await t.recover.execute({ userId: 'u1' })).recovered, 0);
    assert.equal((await t.store.runs.get('u2', 'de-outro'))?.status, 'running');
    assert.equal((await t.store.messages.list('u1', 'c1', { limit: 10 })).length, 1, 'recuperar nao cria mensagens');
  });

  it('o corte e maxMs + 30 s (minimo 90 s): com limite de 300 s, 200 s sem batimento ainda e uma execucao viva', async () => {
    const t = await setup(300_000);
    await seedRun(t.store, 'longa', 'u1', 'c1', 200);
    assert.equal((await t.recover.execute({ userId: 'u1' })).recovered, 0);
    const curta = await setup(5_000);
    await seedRun(curta.store, 'curta', 'u1', 'c1', 60);
    assert.equal((await curta.recover.execute({ userId: 'u1' })).recovered, 0, 'minimo de 90 s');
    await seedRun(curta.store, 'curta2', 'u1', 'c1', 100);
    assert.equal((await curta.recover.execute({ userId: 'u1' })).recovered, 1);
  });

  it('entrada invalida', async () => {
    const t = await setup();
    await assert.rejects(t.recover.execute({}), InvalidInputError);
  });
});
