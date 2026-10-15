import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateLimitStatus } from '../../../src/domain/spending-limit/limit.status.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';

const MAX = Money.fromCents(100_00);

test('abaixo de 80% do limite e ok', () => {
  assert.equal(calculateLimitStatus(MAX, Money.fromCents(79_99)), 'ok');
  assert.equal(calculateLimitStatus(MAX, Money.zero()), 'ok');
});

test('a partir de 80% do limite (inclusive) e at-risk', () => {
  assert.equal(calculateLimitStatus(MAX, Money.fromCents(80_00)), 'at-risk');
  assert.equal(calculateLimitStatus(MAX, Money.fromCents(99_99)), 'at-risk');
});

test('exatamente no limite ainda e at-risk (nao excedeu)', () => {
  assert.equal(calculateLimitStatus(MAX, MAX), 'at-risk');
});

test('acima do limite e exceeded (CA-4)', () => {
  assert.equal(calculateLimitStatus(MAX, Money.fromCents(100_01)), 'exceeded');
  assert.equal(calculateLimitStatus(MAX, Money.fromCents(200_00)), 'exceeded');
});
