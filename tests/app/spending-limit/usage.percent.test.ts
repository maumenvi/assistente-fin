import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usagePercent } from '../../../src/app/spending-limit/usage.percent.ts';

/** Calculo unico de "% usado" (spec 023, SC-005). */
test('percentual inteiro arredondado; total zero = 0; pode passar de 100', () => {
  assert.equal(usagePercent(41_000, 100_000), 41);
  assert.equal(usagePercent(1, 3), 33);
  assert.equal(usagePercent(2, 3), 67);
  assert.equal(usagePercent(500, 0), 0);
  assert.equal(usagePercent(143, 100), 143);
});
