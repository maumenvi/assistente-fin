import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidOptionalDate } from '../../../src/domain/shared/is.valid.optional.date.ts';

test('aceita null, undefined e Date valida', () => {
  assert.equal(isValidOptionalDate(null), true);
  assert.equal(isValidOptionalDate(undefined), true);
  assert.equal(isValidOptionalDate(new Date('2026-01-01T00:00:00.000Z')), true);
});

test('recusa Date invalida e nao-datas', () => {
  assert.equal(isValidOptionalDate(new Date('nao-e-data')), false);
  assert.equal(isValidOptionalDate('2026-01-01'), false);
  assert.equal(isValidOptionalDate(1_735_689_600_000), false);
  assert.equal(isValidOptionalDate({}), false);
});
