import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryTrend } from '../../../src/domain/forecast/category.trend.ts';

test('menos de 2 pontos devolve 0 (CA-18: sem dado suficiente)', () => {
  assert.equal(categoryTrend([]), 0);
  assert.equal(categoryTrend([500]), 0);
});

test('serie crescente devolve tendencia positiva', () => {
  // deltas: +100, +100 -> media +100
  assert.equal(categoryTrend([100, 200, 300]), 100);
});

test('serie decrescente devolve tendencia negativa', () => {
  assert.equal(categoryTrend([300, 200, 100]), -100);
});

test('serie estavel devolve tendencia 0', () => {
  assert.equal(categoryTrend([200, 200, 200]), 0);
});

test('variacao irregular tira a media dos deltas', () => {
  // deltas: +300, -100 -> media 100
  assert.equal(categoryTrend([100, 400, 300]), 100);
});
