import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SystemClock } from '../../../src/libs/clock/system.clock.ts';

test('now devolve uma data valida proxima do relogio do sistema', () => {
  const before = Date.now();
  const now = new SystemClock().now();
  const after = Date.now();

  assert.ok(now instanceof Date);
  assert.ok(now.getTime() >= before && now.getTime() <= after);
});
