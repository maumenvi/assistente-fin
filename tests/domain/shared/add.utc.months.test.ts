import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addUtcMonths } from '../../../src/domain/shared/add.utc.months.ts';

test('addUtcMonths soma meses preservando dia e hora', () => {
  assert.equal(
    addUtcMonths(new Date('2026-03-10T09:15:00.000Z'), 5).toISOString(),
    '2026-08-10T09:15:00.000Z',
  );
});

test('addUtcMonths cruza o ano', () => {
  assert.equal(
    addUtcMonths(new Date('2026-11-10T00:00:00.000Z'), 3).toISOString(),
    '2027-02-10T00:00:00.000Z',
  );
});

test('addUtcMonths ancora no ultimo dia quando o dia nao existe (31/jan + 1 -> 28/fev)', () => {
  assert.equal(
    addUtcMonths(new Date('2026-01-31T00:00:00.000Z'), 1).toISOString(),
    '2026-02-28T00:00:00.000Z',
  );
  assert.equal(
    addUtcMonths(new Date('2028-01-31T00:00:00.000Z'), 1).toISOString(),
    '2028-02-29T00:00:00.000Z',
  );
});

test('addUtcMonths aceita valor negativo', () => {
  assert.equal(
    addUtcMonths(new Date('2026-03-31T00:00:00.000Z'), -1).toISOString(),
    '2026-02-28T00:00:00.000Z',
  );
});
