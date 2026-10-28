import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ActiveRuns } from '../../../src/app/agent/runs/active.runs.ts';
import { AgentActivityTracker } from '../../../src/app/agent/runs/agent.activity.tracker.ts';
import { type ActivityTransition } from '../../../src/app/agent/runs/activity.transition.ts';
import { type AgentEvent } from '../../../src/app/agent/ports/events/agent.event.ts';
import { MAX_CONCURRENT_RUNS } from '../../../src/domain/agent/max.concurrent.runs.ts';

const started = (c: string): AgentEvent => ({ type: 'run_started', runId: `r-${c}`, conversationId: c, seq: 0, userMessageId: 'u', assistantMessageId: 'a' });
const finished = (c: string, status: 'done' | 'failed' | 'cancelled' | 'interrupted', code?: string): AgentEvent => ({
  type: 'run_finished', runId: `r-${c}`, conversationId: c, seq: 9, status, ...(code === undefined ? {} : { error: { code, message: 'x' } }),
});

describe('AgentActivityTracker (spec 040, R6/R7)', () => {
  it('duas conversas executam ao mesmo tempo, cada uma com seu estado', () => {
    const t = new AgentActivityTracker();
    t.observe(started('A'));
    t.observe(started('B'));
    assert.deepEqual(t.runningIds().sort(), ['A', 'B']);
    t.observe(finished('A', 'done'));
    assert.equal(t.get('A')?.state, 'completed');
    assert.equal(t.get('B')?.state, 'running');
  });

  it('plano pendente ou capacidade pedida: ao terminar fica aguardando a pessoa', () => {
    const t = new AgentActivityTracker();
    t.observe(started('A'));
    t.observe({ type: 'plan_updated', runId: 'r-A', conversationId: 'A', seq: 1, messageId: 'm', planId: 'p', status: 'pending' } as AgentEvent);
    t.observe(finished('A', 'done'));
    assert.deepEqual([t.get('A')?.state, t.get('A')?.reason], ['awaiting_user', 'plan']);
    t.observe(started('C'));
    t.observe({ type: 'capability_requested', runId: 'r-C', conversationId: 'C', seq: 1, messageId: 'm', requestId: 'q' });
    t.observe(finished('C', 'done'));
    assert.deepEqual([t.get('C')?.state, t.get('C')?.reason], ['awaiting_user', 'capability']);
  });

  it('pausa por limite espera "Continuar"; outra falha e apenas falha; cancelada e interrompida', () => {
    const t = new AgentActivityTracker();
    t.observe(started('A')); t.observe(finished('A', 'failed', 'LIMIT_STEPS'));
    t.observe(started('B')); t.observe(finished('B', 'failed', 'LLM_AUTH'));
    t.observe(started('C')); t.observe(finished('C', 'cancelled'));
    assert.deepEqual([t.get('A')?.state, t.get('A')?.reason], ['awaiting_user', 'limit']);
    assert.equal(t.get('B')?.state, 'failed');
    assert.equal(t.get('C')?.state, 'interrupted');
  });

  it('emite transicoes e ordena: aguardando primeiro, depois executando', () => {
    const t = new AgentActivityTracker();
    const seen: ActivityTransition[] = [];
    t.onTransition((x) => seen.push(x));
    t.observe(started('A')); t.observe(finished('A', 'done'));
    t.observe(started('B'));
    t.observe(started('W')); t.observe({ type: 'capability_requested', runId: 'r-W', conversationId: 'W', seq: 1, messageId: 'm', requestId: 'q' }); t.observe(finished('W', 'done'));
    assert.deepEqual(seen.slice(0, 2).map((x) => [x.from, x.to]), [[null, 'running'], ['running', 'completed']]);
    assert.deepEqual(t.list().map((a) => a.conversationId), ['W', 'B', 'A']);
    t.forget('B');
    assert.equal(t.get('B'), undefined);
  });
});

describe('ActiveRuns.assertCapacity (spec 040, FR-008)', () => {
  it('recusa a execucao acima do teto e aceita de novo quando uma termina', () => {
    const runs = new ActiveRuns();
    for (let i = 0; i < MAX_CONCURRENT_RUNS; i += 1) {
      runs.assertCapacity();
      runs.register({ runId: `r${i}`, conversationId: `c${i}`, userId: 'u', controller: new AbortController(), settled: Promise.resolve() });
    }
    assert.throws(() => runs.assertCapacity(), { code: 'CONCURRENCY_LIMIT' });
    runs.release('r0');
    assert.doesNotThrow(() => runs.assertCapacity());
  });

  it('pasta ou edicao esperando a pessoa: a conversa fica aguardando e volta a executar quando decidida (spec 040, FR-010)', () => {
    const t = new AgentActivityTracker();
    const transitions: ActivityTransition[] = [];
    t.onTransition((x) => transitions.push(x));
    t.observe(started('A'));
    t.observe({ type: 'folder_permission_requested', runId: 'r-A', conversationId: 'A', seq: 1, requestId: 'q1', path: '/x', access: 'read' } as AgentEvent);
    assert.deepEqual([t.get('A')?.state, t.get('A')?.reason], ['awaiting_user', 'folder_permission']);
    t.observe({ type: 'file_edit_confirmation_requested', runId: 'r-A', conversationId: 'A', seq: 2, requestId: 'q2', path: '/x/a', preview: { before: 'a', after: 'b', truncated: false } } as AgentEvent);
    assert.equal(t.get('A')?.reason, 'file_edit');
    t.observe({ type: 'file_request_resolved', runId: 'r-A', conversationId: 'A', seq: 3, requestId: 'q2', outcome: 'allowed' } as AgentEvent);
    assert.deepEqual([t.get('A')?.state, t.get('A')?.reason], ['awaiting_user', 'folder_permission'], 'ainda falta o primeiro pedido');
    t.observe({ type: 'file_request_resolved', runId: 'r-A', conversationId: 'A', seq: 4, requestId: 'q1', outcome: 'denied' } as AgentEvent);
    assert.deepEqual([t.get('A')?.state, t.get('A')?.reason], ['running', null]);
    assert.ok(transitions.some((x) => x.to === 'awaiting_user' && x.reason === 'folder_permission'));
  });
});
