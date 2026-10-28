import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatBrl } from '../../../src/app/agent/verify/format.brl.ts';
import { parseBrlToCents } from '../../../src/app/agent/verify/parse.brl.ts';

describe('formatBrl', () => {
  it('formata centavos inteiros', () => {
    assert.equal(formatBrl(0), 'R$ 0,00');
    assert.equal(formatBrl(5), 'R$ 0,05');
    assert.equal(formatBrl(128460), 'R$ 1.284,60');
    assert.equal(formatBrl(100_000_000), 'R$ 1.000.000,00');
    assert.equal(formatBrl(999), 'R$ 9,99');
  });

  it('negativo leva o sinal antes do R$', () => {
    assert.equal(formatBrl(-1000), '-R$ 10,00');
    assert.equal(formatBrl(-5), '-R$ 0,05');
  });

  it('recusa nao inteiros', () => {
    assert.throws(() => formatBrl(10.5), RangeError);
    assert.throws(() => formatBrl(Number.NaN), RangeError);
  });
});

describe('parseBrlToCents', () => {
  it('le formatos pt-BR', () => {
    assert.equal(parseBrlToCents('1.284,60'), 128460);
    assert.equal(parseBrlToCents('1284,60'), 128460);
    assert.equal(parseBrlToCents('1284'), 128400);
    assert.equal(parseBrlToCents('R$ 1.284,60'), 128460);
    assert.equal(parseBrlToCents('R$10'), 1000);
    assert.equal(parseBrlToCents('0,05'), 5);
  });

  it('uma casa decimal vale dezenas de centavos', () => {
    assert.equal(parseBrlToCents('10,5'), 1050);
    assert.equal(parseBrlToCents('1.284,6'), 128460);
  });

  it('negativos', () => {
    assert.equal(parseBrlToCents('-10,00'), -1000);
    assert.equal(parseBrlToCents('-R$ 10,00'), -1000);
  });

  it('ponto so e separador de milhar: formato americano e invalido', () => {
    assert.equal(parseBrlToCents('1284.5'), null);
    assert.equal(parseBrlToCents('1.28'), null);
  });

  it('entradas invalidas devolvem null', () => {
    for (const bad of ['', 'abc', 'R$', '1,234,56', '10,567', '--5', '1 000']) {
      assert.equal(parseBrlToCents(bad), null, bad);
    }
  });

  it('ida e volta com formatBrl', () => {
    for (const cents of [0, 1, 99, 100, 128460, 100_000_000, 1_234_567_89]) {
      assert.equal(parseBrlToCents(formatBrl(cents)), cents);
    }
  });
});
