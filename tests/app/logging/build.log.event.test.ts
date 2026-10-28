import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLogEvent } from '../../../src/app/logging/build.log.event.ts';

const base = {
  id: 'e1',
  timestamp: '2026-10-22T10:00:00.000Z',
  source: 'mcp' as const,
  operation: 'create_account',
  userId: 'u1',
  correlationId: 'c1',
  startedAtMs: 100,
  nowMs: 130,
};

test('sucesso: error nulo e duracao calculada', () => {
  const event = buildLogEvent({ ...base, outcome: 'success', input: { a: 1 } });
  assert.equal(event.durationMs, 30);
  assert.equal(event.error, null);
  assert.deepEqual(event.input, { a: 1 });
  assert.deepEqual(event.subjectIds, {});
});

test('erro com Error preserva name/message/stack originais', () => {
  const original = new TypeError('quebrou');
  const event = buildLogEvent({ ...base, outcome: 'error', error: original });
  assert.equal(event.error?.name, 'TypeError');
  assert.equal(event.error?.message, 'quebrou');
  assert.equal(event.error?.stack, original.stack);
});

test('erro que nao e Error vira NonError', () => {
  const event = buildLogEvent({ ...base, outcome: 'error', error: 'texto' });
  assert.deepEqual(event.error, { name: 'NonError', message: 'texto', stack: null });
});

test('duracao nunca e negativa', () => {
  const event = buildLogEvent({ ...base, nowMs: 50, outcome: 'success' });
  assert.equal(event.durationMs, 0);
});

test('error so existe quando outcome e error', () => {
  const event = buildLogEvent({ ...base, outcome: 'success', error: new Error('x') });
  assert.equal(event.error, null);
});

test('deviceId padrao nulo e preenchido quando informado (sync/mobile)', () => {
  assert.equal(buildLogEvent({ ...base, outcome: 'success' }).deviceId, null);
  const event = buildLogEvent({ ...base, source: 'mobile', deviceId: 'dev-1', outcome: 'success' });
  assert.equal(event.source, 'mobile');
  assert.equal(event.deviceId, 'dev-1');
});
