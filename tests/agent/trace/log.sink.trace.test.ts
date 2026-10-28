import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LogSinkAgentLog } from '../../../src/app/agent/log/log.sink.agent.log.ts';
import { LogSinkTrace } from '../../../src/app/agent/trace/log.sink.trace.ts';
import { type LogSink } from '../../../src/app/shared/log.sink.port.ts';
import { logEventOutputSchema } from '../../../src/app/logging/log.event.output.schema.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { makeRun, makeStep } from '../store/support/agent.fixtures.ts';
import { CollectingLogSink, stepEvent } from './support.ts';

const now = () => new Date('2026-10-22T12:00:00Z');

describe('LogSinkTrace', () => {
  it('1 evento por passo (agent.node.<no>) com metadados e sem prompts', () => {
    const sink = new CollectingLogSink();
    const trace = new LogSinkTrace(sink, { source: 'ipc', ids: new SequentialIdGenerator(), now });
    trace.emit({ type: 'step', userId: 'u1', step: makeStep('r1', 1, { request: { messages: ['SEGREDO-do-prompt'] }, response: { text: 'resposta-bruta' } }) });
    assert.equal(sink.events.length, 1);
    const event = sink.events[0];
    assert.equal(event?.operation, 'agent.node.react');
    assert.equal(event?.source, 'ipc');
    assert.equal(event?.userId, 'u1');
    assert.equal(event?.correlationId, 'r1');
    assert.equal(event?.durationMs, 120);
    assert.equal(event?.outcome, 'success');
    assert.deepEqual(event?.subjectIds, { runId: 'r1' });
    const text = JSON.stringify(event);
    assert.equal(text.includes('SEGREDO-do-prompt'), false, 'prompt nao pode ir para o LogSink');
    assert.equal(text.includes('resposta-bruta'), false, 'resposta bruta nao pode ir para o LogSink');
    assert.equal((event?.input as { toolCalls: { name: string }[] }).toolCalls[0]?.name, 'query_transactions');
  });

  it('passo com erro vira outcome error com o erro original', () => {
    const sink = new CollectingLogSink();
    const trace = new LogSinkTrace(sink, { source: 'ipc', ids: new SequentialIdGenerator(), now });
    trace.emit({ type: 'step', userId: 'u1', step: makeStep('r1', 2, { status: 'error', error: { code: 'LLM_UNAVAILABLE', message: 'caiu' } }) });
    assert.equal(sink.events[0]?.outcome, 'error');
    assert.equal(sink.events[0]?.error?.name, 'LLM_UNAVAILABLE');
  });

  it('1 evento por execucao (agent.run) e nenhum no inicio', () => {
    const sink = new CollectingLogSink();
    const trace = new LogSinkTrace(sink, { source: 'ipc', ids: new SequentialIdGenerator(), now });
    const run = makeRun('r1', 'c1', 'u1');
    trace.emit({ type: 'run_started', userId: 'u1', run: { id: 'r1', conversationId: 'c1', question: 'q', status: 'running', intent: null, consumed: run.consumed, profileIds: run.profileIds, model: null, startedAt: run.startedAt, endedAt: null, errorCode: null } });
    assert.equal(sink.events.length, 0);
    trace.emit({ type: 'run_finished', userId: 'u1', runId: 'r1', conversationId: 'c1', status: 'done', consumed: { ...run.consumed, steps: 5, inputTokens: 1240 }, durationMs: 2100, errorCode: null });
    assert.equal(sink.events.length, 1);
    const event = sink.events[0];
    assert.equal(event?.operation, 'agent.run');
    assert.deepEqual(event?.subjectIds, { runId: 'r1', conversationId: 'c1' });
    assert.equal(event?.durationMs, 2100);
    assert.equal(event?.outcome, 'success');
    assert.equal((event?.input as { steps: number }).steps, 5);
  });

  it('falha e interrupcao viram erro; cancelamento do usuario nao', () => {
    const sink = new CollectingLogSink();
    const trace = new LogSinkTrace(sink, { source: 'ipc', ids: new SequentialIdGenerator(), now });
    const consumed = makeRun('r1', 'c1', 'u1').consumed;
    for (const status of ['failed', 'interrupted', 'cancelled'] as const) {
      trace.emit({ type: 'run_finished', userId: 'u1', runId: 'r1', conversationId: 'c1', status, consumed, durationMs: 1, errorCode: status === 'failed' ? 'LLM_AUTH' : null });
    }
    assert.deepEqual(sink.events.map((e) => e.outcome), ['error', 'error', 'success']);
  });

  it('os eventos obedecem ao schema de saida da spec 017', () => {
    const sink = new CollectingLogSink();
    const trace = new LogSinkTrace(sink, { source: 'ipc', ids: new SequentialIdGenerator(), now });
    trace.emit(stepEvent('r1', 1));
    trace.emit({ type: 'run_finished', userId: 'u1', runId: 'r1', conversationId: 'c1', status: 'failed', consumed: makeRun('r1', 'c1', 'u1').consumed, durationMs: 9, errorCode: 'X' });
    for (const event of sink.events) assert.doesNotThrow(() => logEventOutputSchema.parse(event));
  });

  it('chaves nos argumentos das ferramentas sao mascaradas', () => {
    const sink = new CollectingLogSink();
    const trace = new LogSinkTrace(sink, { source: 'ipc', ids: new SequentialIdGenerator(), now });
    trace.emit({ type: 'step', userId: 'u1', step: makeStep('r1', 1, { toolCalls: [{ id: 'c', name: 't', args: { apiKey: 'sk-aaaaaaaaaa', q: 1 }, resultSummary: 'ok com sk-bbbbbbbbbb', ms: 1, truncated: false }] }) });
    assert.equal(JSON.stringify(sink.events[0]).includes('sk-aaaaaaaaaa'), false);
    assert.equal(JSON.stringify(sink.events[0]).includes('sk-bbbbbbbbbb'), false);
  });

  it('LogSink que lanca ou ausente nao quebra', () => {
    const throwing: LogSink = { record: () => { throw new Error('disco'); } };
    assert.doesNotThrow(() => new LogSinkTrace(throwing, { source: 'ipc', ids: new SequentialIdGenerator(), now }).emit(stepEvent('r1', 1)));
    assert.doesNotThrow(() => new LogSinkTrace(null, { source: 'ipc', ids: new SequentialIdGenerator(), now }).emit(stepEvent('r1', 1)));
  });
});

describe('LogSinkAgentLog', () => {
  it('warn vira LogEvent agent.internal com erro e campos mascarados', () => {
    const sink = new CollectingLogSink();
    const log = new LogSinkAgentLog(sink, { source: 'ipc', ids: new SequentialIdGenerator(), now });
    log.warn('trace: falha ao gravar passos com sk-cccccccccc', { steps: 3, apiKey: 'sk-dddddddddd' });
    const event = sink.events[0];
    assert.equal(event?.operation, 'agent.internal');
    assert.equal(event?.outcome, 'error');
    assert.equal(event?.error?.name, 'AgentWarning');
    assert.equal(JSON.stringify(event).includes('sk-cccccccccc'), false);
    assert.equal(JSON.stringify(event).includes('sk-dddddddddd'), false);
    assert.equal((event?.input as { steps: number }).steps, 3);
  });

  it('error usa AgentError', () => {
    const sink = new CollectingLogSink();
    new LogSinkAgentLog(sink, { source: 'ipc', ids: new SequentialIdGenerator(), now }).error('falhou');
    assert.equal(sink.events[0]?.error?.name, 'AgentError');
  });

  it('sem LogSink cai para o console com prefixo [agent]', () => {
    const lines: string[] = [];
    const log = new LogSinkAgentLog(null, { source: 'ipc', ids: new SequentialIdGenerator(), fallback: (_l, m) => lines.push(m) });
    log.warn('aviso');
    assert.deepEqual(lines, ['[agent] aviso']);
  });

  it('LogSink que lanca nao quebra', () => {
    const throwing: LogSink = { record: () => { throw new Error('x'); } };
    assert.doesNotThrow(() => new LogSinkAgentLog(throwing, { source: 'ipc', ids: new SequentialIdGenerator() }).warn('x'));
  });
});
