import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addUtcDays } from '../../../src/domain/shared/add.utc.days.ts';

test('addUtcDays soma dias preservando a hora', () => {
  assert.equal(
    addUtcDays(new Date('2026-03-10T13:30:00.000Z'), 5).toISOString(),
    '2026-03-15T13:30:00.000Z',
  );
});

test('addUtcDays cruza mes e ano', () => {
  assert.equal(
    addUtcDays(new Date('2026-12-28T00:00:00.000Z'), 10).toISOString(),
    '2027-01-07T00:00:00.000Z',
  );
});

test('addUtcDays aceita valor negativo', () => {
  assert.equal(
    addUtcDays(new Date('2026-03-01T00:00:00.000Z'), -1).toISOString(),
    '2026-02-28T00:00:00.000Z',
  );
});
