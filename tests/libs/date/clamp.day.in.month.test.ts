import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampDayInMonth } from '../../../src/libs/date/clamp.day.in.month.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

test('dia que cabe no mes-alvo e preservado', () => {
  const date = clampDayInMonth(5, Month.create({ year: 2026, month: 3 }));
  assert.equal(date.toISOString(), '2026-03-05T00:00:00.000Z');
});

test('dia 31 em mes de 30 dias -> ultimo dia do mes (30)', () => {
  const date = clampDayInMonth(31, Month.create({ year: 2026, month: 4 }));
  assert.equal(date.toISOString(), '2026-04-30T00:00:00.000Z');
});

test('dia 31 em fevereiro nao-bissexto -> 28', () => {
  const date = clampDayInMonth(31, Month.create({ year: 2026, month: 2 }));
  assert.equal(date.toISOString(), '2026-02-28T00:00:00.000Z');
});

test('dia 31 em fevereiro bissexto -> 29', () => {
  const date = clampDayInMonth(31, Month.create({ year: 2028, month: 2 }));
  assert.equal(date.toISOString(), '2028-02-29T00:00:00.000Z');
});

test('dia 1 sempre cabe', () => {
  const date = clampDayInMonth(1, Month.create({ year: 2026, month: 2 }));
  assert.equal(date.toISOString(), '2026-02-01T00:00:00.000Z');
});
