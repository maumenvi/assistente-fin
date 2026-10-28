import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCorrelationId } from '../../../src/app/logging/new.correlation.id.ts';

test('ids distintos a cada chamada', () => {
  let n = 0;
  const ids = { next: () => `id-${++n}` };
  assert.notEqual(newCorrelationId(ids), newCorrelationId(ids));
});
