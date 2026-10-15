import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumberWords, parseSpokenAmount } from '../../../src/domain/capture/parse.number.words.ts';

test('numeros por extenso', () => {
  assert.deepEqual(parseNumberWords('cento e quarenta e cinco'), [145]);
  assert.deepEqual(parseNumberWords('dois mil trezentos e doze'), [2312]);
  assert.deepEqual(parseNumberWords('mil e quinhentos'), [1500]);
  assert.deepEqual(parseNumberWords('cem'), [100]);
  assert.deepEqual(parseNumberWords('dezenove'), [19]);
  assert.deepEqual(parseNumberWords('cento e quarenta e cinco e trinta'), [145, 30], 'unidade nao absorve dezena: numero novo');
});

test('valor falado em reais e centavos', () => {
  assert.equal(parseSpokenAmount('cento e quarenta e cinco e trinta'), 14530);
  assert.equal(parseSpokenAmount('sessenta e cinco reais'), 6500);
  assert.equal(parseSpokenAmount('vinte reais e cinquenta centavos'), 2050);
  assert.equal(parseSpokenAmount('um real e noventa'), 190);
  assert.equal(parseSpokenAmount('nada aqui'), null);
});
