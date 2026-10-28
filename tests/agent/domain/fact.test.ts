import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type Fact } from '../../../src/domain/agent/fact.ts';
import { isMoneyFactValid } from '../../../src/domain/agent/is.money.fact.valid.ts';

const base = { id: 'f1', display: 'R$ 1.284,60', label: 'Mercado', sourceCallId: 'c1' } as const;

describe('isMoneyFactValid', () => {
  it('aceita dinheiro em centavos inteiros', () => {
    const fact: Fact = { ...base, kind: 'money', value: 128460 };
    assert.equal(isMoneyFactValid(fact), true);
  });

  it('recusa centavos nao inteiros', () => {
    assert.equal(isMoneyFactValid({ ...base, kind: 'money', value: 1284.6 }), false);
  });

  it('recusa dinheiro com valor textual', () => {
    assert.equal(isMoneyFactValid({ ...base, kind: 'money', value: '128460' }), false);
  });

  it('nao exige inteiro dos demais tipos', () => {
    assert.equal(isMoneyFactValid({ ...base, kind: 'percent', value: 28.5, display: '28,5%' }), true);
    assert.equal(isMoneyFactValid({ ...base, kind: 'date', value: '2026-09-30', display: '30/09/2026' }), true);
  });
});
