import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameCalendarDay } from '../../../src/libs/date/same.calendar.day.ts';

test('true para o mesmo dia, horas diferentes', () => {
  assert.equal(
    sameCalendarDay(new Date('2026-01-05T00:00:00.000Z'), new Date('2026-01-05T23:59:59.000Z')),
    true,
  );
});

test('false para dias diferentes', () => {
  assert.equal(
    sameCalendarDay(new Date('2026-01-05T23:00:00.000Z'), new Date('2026-01-06T01:00:00.000Z')),
    false,
  );
});

test('false para mesmo dia/mes, ano diferente', () => {
  assert.equal(
    sameCalendarDay(new Date('2025-01-05T00:00:00.000Z'), new Date('2026-01-05T00:00:00.000Z')),
    false,
  );
});
