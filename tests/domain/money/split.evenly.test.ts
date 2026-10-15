import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInstallmentPlan } from '../../../src/domain/money/split.evenly.ts';

test('divisao exata: todas as parcelas iguais', () => {
  assert.deepEqual(buildInstallmentPlan(1_000, 4), [250, 250, 250, 250]);
});

test('divisao com resto: primeiras parcelas absorvem 1 centavo a mais (CA-9)', () => {
  assert.deepEqual(buildInstallmentPlan(1_000, 3), [334, 333, 333]);
  assert.deepEqual(buildInstallmentPlan(101, 4), [26, 25, 25, 25]);
});

test('soma das parcelas sempre bate com o total, qualquer combinacao', () => {
  for (const [total, installments] of [[1_000, 3], [101, 7], [999_999, 12], [1, 5]] as const) {
    const plan = buildInstallmentPlan(total, installments);
    assert.equal(plan.length, installments);
    assert.equal(plan.reduce((sum, cents) => sum + cents, 0), total);
  }
});

test('uma parcela devolve o total inteiro (a vista)', () => {
  assert.deepEqual(buildInstallmentPlan(5_000, 1), [5_000]);
});

test('rejeita installments invalido', () => {
  assert.throws(() => buildInstallmentPlan(1_000, 0));
  assert.throws(() => buildInstallmentPlan(1_000, -1));
  assert.throws(() => buildInstallmentPlan(1_000, 1.5));
});
