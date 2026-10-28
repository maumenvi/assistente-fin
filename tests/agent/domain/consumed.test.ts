import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addConsumed } from '../../../src/domain/agent/add.consumed.ts';
import { type Consumed } from '../../../src/domain/agent/consumed.ts';
import { EMPTY_CONSUMED } from '../../../src/domain/agent/empty.consumed.ts';

const a: Consumed = { steps: 1, ms: 100, inputTokens: 10, outputTokens: 5, cachedTokens: 2, costMicroUsd: 400 };

describe('addConsumed', () => {
  it('soma todos os campos', () => {
    const sum = addConsumed(a, { steps: 2, ms: 50, inputTokens: 1, outputTokens: 1, cachedTokens: 0, costMicroUsd: 100 });
    assert.deepEqual(sum, { steps: 3, ms: 150, inputTokens: 11, outputTokens: 6, cachedTokens: 2, costMicroUsd: 500 });
  });

  it('custo null + numero = numero', () => {
    assert.equal(addConsumed(EMPTY_CONSUMED, a).costMicroUsd, 400);
    assert.equal(addConsumed(a, EMPTY_CONSUMED).costMicroUsd, 400);
  });

  it('custo null + null = null (custo desconhecido)', () => {
    assert.equal(addConsumed(EMPTY_CONSUMED, EMPTY_CONSUMED).costMicroUsd, null);
  });

  it('o consumo vazio nao pode ser alterado', () => {
    assert.throws(() => {
      (EMPTY_CONSUMED as { steps: number }).steps = 9;
    }, TypeError);
  });
});
