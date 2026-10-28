import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { StoreTrace } from '../../../src/app/agent/trace/store.trace.ts';
import { type AgentStorePort } from '../../../src/app/agent/ports/store/agent.store.port.ts';
import { type RunStep } from '../../../src/domain/agent/run.step.ts';
import { FakeAgentStore } from '../../../src/database/fake/agent.store.fake.ts';
import { makeConversation, makeRun, makeStep } from '../store/support/agent.fixtures.ts';
import { CollectingAgentLog, stepEvent } from './support.ts';

/** Agendador manual: o teste decide quando o tempo "passa". */
function manualScheduler(): { schedule: (work: () => void, ms: number) => () => void; fire: () => void; scheduled: number[] } {
  const pending: { work: () => void; ms: number; id: number }[] = [];
  const scheduled: number[] = [];
  let next = 0;
  return {
    scheduled,
    schedule: (work, ms) => {
      const id = next++;
      scheduled.push(ms);
      pending.push({ work, ms, id });
      return () => {
        const index = pending.findIndex((p) => p.id === id);
        if (index >= 0) pending.splice(index, 1);
      };
    },
    fire: () => {
      const batch = pending.splice(0);
      for (const item of batch) item.work();
    },
  };
}

async function seededStore(): Promise<FakeAgentStore> {
  const store = new FakeAgentStore();
  await store.conversations.create(makeConversation('c1', 'u1'));
  await store.runs.create(makeRun('r1', 'c1', 'u1'));
  return store;
}

describe('StoreTrace', () => {
  it('emit apenas enfileira e retorna: sem I/O, mesmo com store lento', async () => {
    let finishWrite: () => void = () => undefined;
    const slow: AgentStorePort = {
      ...new FakeAgentStore(),
      steps: {
        appendMany: () => new Promise<void>((resolve) => { finishWrite = resolve; }),
        list: () => Promise.resolve([]),
      },
    };
    const sched = manualScheduler();
    const trace = new StoreTrace(slow, new CollectingAgentLog(), { schedule: sched.schedule });
    const started = performance.now();
    for (let i = 1; i <= 20; i += 1) trace.emit(stepEvent('r1', i));
    assert.ok(performance.now() - started < 20, 'emit nao pode esperar o store');
    sched.fire();
    finishWrite();
  });

  it('grava em lote depois do intervalo e preserva a ordem por seq', async () => {
    const store = await seededStore();
    const sched = manualScheduler();
    const trace = new StoreTrace(store, new CollectingAgentLog(), { schedule: sched.schedule });
    trace.emit(stepEvent('r1', 1));
    trace.emit(stepEvent('r1', 2));
    assert.deepEqual(await store.steps.list('u1', 'r1'), []);
    assert.deepEqual(sched.scheduled, [250]);
    sched.fire();
    await trace.flush(1000);
    assert.deepEqual((await store.steps.list('u1', 'r1')).map((s) => s.seq), [1, 2]);
  });

  it('lote cheio (50) grava na hora, sem esperar o intervalo', async () => {
    const store = await seededStore();
    const sched = manualScheduler();
    const trace = new StoreTrace(store, new CollectingAgentLog(), { schedule: sched.schedule });
    for (let i = 1; i <= 50; i += 1) trace.emit(stepEvent('r1', i));
    assert.equal(sched.scheduled.at(-1), 0);
    sched.fire();
    await trace.flush(1000);
    assert.equal((await store.steps.list('u1', 'r1')).length, 50);
  });

  it('store que lanca: emit nao propaga, vira log.warn e a proxima gravacao continua', async () => {
    const log = new CollectingAgentLog();
    let calls = 0;
    const failing: AgentStorePort = {
      ...new FakeAgentStore(),
      steps: {
        appendMany: () => {
          calls += 1;
          return calls === 1 ? Promise.reject(new Error('disco cheio')) : Promise.resolve();
        },
        list: () => Promise.resolve([]),
      },
    };
    const sched = manualScheduler();
    const trace = new StoreTrace(failing, log, { schedule: sched.schedule });
    assert.doesNotThrow(() => trace.emit(stepEvent('r1', 1)));
    sched.fire();
    await trace.flush(1000);
    assert.equal(log.warns.length, 1);
    assert.match(log.warns[0]?.message ?? '', /falha ao gravar/);
    trace.emit(stepEvent('r1', 2));
    await trace.flush(1000);
    assert.equal(calls, 2);
  });

  it('fila cheia descarta o mais antigo e conta a perda em log', async () => {
    const written: RunStep[] = [];
    const store: AgentStorePort = {
      ...new FakeAgentStore(),
      steps: { appendMany: (_u, steps) => { written.push(...steps); return Promise.resolve(); }, list: () => Promise.resolve([]) },
    };
    const log = new CollectingAgentLog();
    const sched = manualScheduler();
    const trace = new StoreTrace(store, log, { maxQueue: 3, batchSize: 100, schedule: sched.schedule });
    for (let i = 1; i <= 5; i += 1) trace.emit(stepEvent('r1', i));
    await trace.flush(1000);
    assert.deepEqual(written.map((s) => s.seq), [3, 4, 5]);
    assert.equal(log.warns.length, 1);
    assert.equal(log.warns[0]?.fields?.['dropped'], 2);
  });

  it('flush respeita o prazo mesmo com store travado', async () => {
    const stuck: AgentStorePort = {
      ...new FakeAgentStore(),
      steps: { appendMany: () => new Promise<void>(() => undefined), list: () => Promise.resolve([]) },
    };
    const trace = new StoreTrace(stuck, new CollectingAgentLog(), { schedule: manualScheduler().schedule });
    trace.emit(stepEvent('r1', 1));
    const started = performance.now();
    await trace.flush(60);
    const elapsed = performance.now() - started;
    assert.ok(elapsed >= 50 && elapsed < 500, `flush levou ${elapsed}ms`);
  });

  it('aplica os tetos de tamanho ao gravar', async () => {
    const store = await seededStore();
    const trace = new StoreTrace(store, new CollectingAgentLog(), { schedule: manualScheduler().schedule });
    trace.emit({ type: 'step', userId: 'u1', step: makeStep('r1', 1, { request: 'a'.repeat(40_000) }) });
    await trace.flush(1000);
    const [step] = await store.steps.list('u1', 'r1');
    assert.equal(step?.truncated, true);
  });

  it('ignora eventos que nao sao de passo e agrupa por usuario', async () => {
    const written: { userId: string; seqs: number[] }[] = [];
    const store: AgentStorePort = {
      ...new FakeAgentStore(),
      steps: { appendMany: (userId, steps) => { written.push({ userId, seqs: steps.map((s) => s.seq) }); return Promise.resolve(); }, list: () => Promise.resolve([]) },
    };
    const trace = new StoreTrace(store, new CollectingAgentLog(), { schedule: manualScheduler().schedule });
    trace.emit({ type: 'run_finished', userId: 'u1', runId: 'r1', conversationId: 'c1', status: 'done', consumed: makeRun('r1', 'c1', 'u1').consumed, durationMs: 5, errorCode: null });
    trace.emit(stepEvent('r1', 1, 'u1'));
    trace.emit(stepEvent('r2', 1, 'u2'));
    await trace.flush(1000);
    assert.deepEqual(written, [{ userId: 'u1', seqs: [1] }, { userId: 'u2', seqs: [1] }]);
  });
});
