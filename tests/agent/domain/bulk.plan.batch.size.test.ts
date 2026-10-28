import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BULK_PLAN_BATCH_SIZE, MAX_PLAN_ITEMS } from '../../../src/app/agent/plan/rules/bulk.plan.batch.size.ts';

describe('limites de lote e plano (spec 037, T016)', () => {
  it('lote em massa e 50 e teto tecnico do plano permanece 200', () => {
    assert.equal(BULK_PLAN_BATCH_SIZE, 50);
    assert.equal(MAX_PLAN_ITEMS, 200);
    assert.ok(BULK_PLAN_BATCH_SIZE <= MAX_PLAN_ITEMS);
  });
});

