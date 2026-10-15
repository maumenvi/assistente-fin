import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recurrenceAppliesToMonth } from '../../../src/domain/shared/recurrence.applies.to.month.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

const month = (year: number, m: number) => Month.create({ year, month: m });
const anchor = month(2026, 1);
const farEnd = new Date('2028-12-31T00:00:00.000Z');

test('nao-repete so se aplica ao proprio mes-ancora', () => {
  const r = Recurrence.none();
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 1)), true);
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 2)), false);
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2025, 12)), false);
});

test('mensal a cada 1 se aplica a partir da ancora, todo mes, ate a data final', () => {
  const r = Recurrence.create({ frequency: 'mensal', endDate: new Date('2026-12-05T00:00:00.000Z') });
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 1)), true);
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 2)), true);
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 12)), true);
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2027, 1)), false, 'depois da data final');
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2025, 12)), false, 'antes da ancora');
});

test('mensal a cada 2 pula um mes sim, um nao', () => {
  const r = Recurrence.create({ frequency: 'mensal', everyN: 2, endDate: farEnd });
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 1)), true);
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 2)), false);
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 3)), true);
});

test('trimestral: a cada 3 meses a partir da ancora', () => {
  const r = Recurrence.create({ frequency: 'trimestral', endDate: farEnd });
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 1)), true);
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 4)), true);
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 3)), false);
});

test('semestral: a cada 6 meses', () => {
  const r = Recurrence.create({ frequency: 'semestral', endDate: farEnd });
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 7)), true);
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 4)), false);
});

test('anual: so no mesmo mes-calendario, a cada ano', () => {
  const r = Recurrence.create({ frequency: 'anual', endDate: new Date('2030-06-01T00:00:00.000Z') });
  const marco = month(2026, 3);
  assert.equal(recurrenceAppliesToMonth(r, marco, month(2026, 3)), true);
  assert.equal(recurrenceAppliesToMonth(r, marco, month(2027, 3)), true);
  assert.equal(recurrenceAppliesToMonth(r, marco, month(2026, 4)), false);
});

test('diaria/semanal se aplicam a todo mes entre ancora e data final (simplificacao)', () => {
  const r = Recurrence.create({ frequency: 'semanal', endDate: new Date('2026-06-30T00:00:00.000Z') });
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 1)), true);
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 6)), true);
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2026, 7)), false, 'depois da data final');
  assert.equal(recurrenceAppliesToMonth(r, anchor, month(2025, 12)), false);
});
