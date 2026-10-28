import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LogIngestDeduper } from '../../../src/app/logging/log.ingest.deduper.ts';

test('detecta duplicata; ids novos nao', () => {
  const deduper = new LogIngestDeduper();
  assert.equal(deduper.seen('a'), false);
  assert.equal(deduper.seen('b'), false);
  assert.equal(deduper.seen('a'), true);
});

test('expulsa o mais antigo ao passar do limite', () => {
  const deduper = new LogIngestDeduper(3);
  for (const id of ['a', 'b', 'c', 'd']) deduper.seen(id);
  assert.equal(deduper.seen('a'), false, 'a foi expulso');
  assert.equal(deduper.seen('d'), true);
});

test('seed marca como vistos', () => {
  const deduper = new LogIngestDeduper();
  deduper.seed(['x', 'y']);
  assert.equal(deduper.seen('x'), true);
});
