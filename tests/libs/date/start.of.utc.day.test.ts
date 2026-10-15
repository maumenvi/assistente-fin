import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startOfUtcDay } from '../../../src/libs/date/start.of.utc.day.ts';

test('zera hora/minuto/segundo em UTC', () => {
  const start = startOfUtcDay(new Date('2026-01-05T23:45:12.345Z'));
  assert.equal(start.toISOString(), '2026-01-05T00:00:00.000Z');
});
