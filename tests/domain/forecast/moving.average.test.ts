import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movingAverage } from '../../../src/domain/forecast/moving.average.ts';

test('serie vazia devolve 0', () => {
  assert.equal(movingAverage([]), 0);
});

test('media simples, arredondada pro centavo mais proximo', () => {
  assert.equal(movingAverage([100, 200, 300]), 200);
  assert.equal(movingAverage([100, 200]), 150);
  assert.equal(movingAverage([100, 100, 101]), 100); // 100.33 -> 100
  assert.equal(movingAverage([100, 100, 102]), 101); // 100.66 -> 101
});

test('funciona com um unico valor', () => {
  assert.equal(movingAverage([500]), 500);
});

test('funciona com valores negativos (ajustes)', () => {
  assert.equal(movingAverage([-100, 100]), 0);
});
