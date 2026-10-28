import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logsRequestSchema, MAX_LOGS_PER_REQUEST } from '../../../src/app/logging/logs.request.schema.ts';

const event = (n: number) => ({
  id: `e${n}`, timestamp: '2026-10-22T10:00:00.000Z', operation: 'createTransaction', userId: 'u1', correlationId: 'c',
  durationMs: 3, outcome: 'success', subjectIds: {}, error: null, input: { n },
});

test('lote valido de 1 a 200 eventos passa; ignora source/deviceId enviados', () => {
  assert.ok(logsRequestSchema.safeParse({ events: [event(1)] }).success);
  const forged = logsRequestSchema.parse({ events: [{ ...event(1), source: 'mcp', deviceId: 'outro' }] });
  assert.ok(!('source' in forged.events[0]!) && !('deviceId' in forged.events[0]!));
  assert.ok(logsRequestSchema.safeParse({ events: Array.from({ length: MAX_LOGS_PER_REQUEST }, (_, i) => event(i)) }).success);
});

test('lote vazio, acima de 200 ou com evento malformado e recusado', () => {
  assert.ok(!logsRequestSchema.safeParse({ events: [] }).success);
  assert.ok(!logsRequestSchema.safeParse({ events: Array.from({ length: MAX_LOGS_PER_REQUEST + 1 }, (_, i) => event(i)) }).success);
  assert.ok(!logsRequestSchema.safeParse({ events: [{ ...event(1), outcome: 'talvez' }] }).success);
  assert.ok(!logsRequestSchema.safeParse({ events: [{ ...event(1), durationMs: -1 }] }).success);
  assert.ok(!logsRequestSchema.safeParse({}).success);
});
