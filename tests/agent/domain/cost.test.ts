import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { microToUsdString } from '../../../src/domain/agent/micro.to.usd.string.ts';
import { usdToMicro } from '../../../src/domain/agent/usd.to.micro.ts';

describe('custo em micro-dolares', () => {
  it('converte dolares em inteiros', () => {
    assert.equal(usdToMicro(0.004), 4000);
    assert.equal(usdToMicro(0.1), 100_000);
    assert.equal(usdToMicro(0), 0);
  });

  it('recusa negativo e nao finito', () => {
    assert.throws(() => usdToMicro(-1), RangeError);
    assert.throws(() => usdToMicro(Number.NaN), RangeError);
    assert.throws(() => usdToMicro(Number.POSITIVE_INFINITY), RangeError);
  });

  it('somar 1000 x 1 micro da exatamente 1000 (sem erro de ponto flutuante)', () => {
    let total = 0;
    for (let i = 0; i < 1000; i += 1) total += usdToMicro(0.000001);
    assert.equal(total, 1000);
  });

  it('formata como US$ com 2 a 6 casas', () => {
    assert.equal(microToUsdString(4000), 'US$ 0,004');
    assert.equal(microToUsdString(100_000), 'US$ 0,10');
    assert.equal(microToUsdString(0), 'US$ 0,00');
    assert.equal(microToUsdString(1), 'US$ 0,000001');
    assert.equal(microToUsdString(1_284_000_000), 'US$ 1.284,00');
  });

  it('recusa micro-dolares nao inteiros ou negativos', () => {
    assert.throws(() => microToUsdString(1.5), RangeError);
    assert.throws(() => microToUsdString(-1), RangeError);
  });
});
