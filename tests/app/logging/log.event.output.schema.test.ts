import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLogEvent } from '../../../src/app/logging/build.log.event.ts';
import { logEventOutputSchema } from '../../../src/app/logging/log.event.output.schema.ts';

const base = {
  id: 'e1',
  timestamp: '2026-10-22T10:00:00.000Z',
  source: 'ipc' as const,
  operation: 'account:create',
  userId: null,
  correlationId: 'c1',
  startedAtMs: 1,
  nowMs: 5,
};

test('evento de sucesso passa no schema', () => {
  const event = buildLogEvent({ ...base, outcome: 'success', input: { name: 'x' } });
  assert.ok(logEventOutputSchema.safeParse(event).success);
});

test('evento de erro passa no schema', () => {
  const event = buildLogEvent({
    ...base,
    outcome: 'error',
    error: new Error('x'),
    subjectIds: { accountId: 'a1' },
  });
  assert.ok(logEventOutputSchema.safeParse(JSON.parse(JSON.stringify(event))).success);
});

test('evento sync/mobile com deviceId passa; linha antiga sem deviceId tambem', () => {
  const event = buildLogEvent({ ...base, source: 'mobile', deviceId: 'dev-1', outcome: 'success' });
  assert.ok(logEventOutputSchema.safeParse(event).success);
  const { deviceId: _omit, ...legacy } = buildLogEvent({ ...base, outcome: 'success' });
  assert.ok(logEventOutputSchema.safeParse(legacy).success);
  assert.ok(logEventOutputSchema.safeParse({ ...event, source: 'sync' }).success);
});
