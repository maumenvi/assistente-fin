import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occurrenceDates } from '../../../src/domain/shared/recurrence.occurrences.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const anchor = new Date('2026-03-01T00:00:00.000Z');

test('nao-repete devolve so a data-ancora', () => {
  assert.deepEqual(occurrenceDates(Recurrence.none(), anchor).map(iso), ['2026-03-01']);
});

test('mensal de 01/03 a 31/08 -> 6 ocorrencias, uma por mes (CA-16)', () => {
  const r = Recurrence.create({ frequency: 'mensal', endDate: new Date('2026-08-31T00:00:00.000Z') });
  assert.deepEqual(occurrenceDates(r, anchor).map(iso), [
    '2026-03-01',
    '2026-04-01',
    '2026-05-01',
    '2026-06-01',
    '2026-07-01',
    '2026-08-01',
  ]);
});

test('quinzenal (semanal a cada 2) gera ocorrencias a cada 14 dias (CA-18a)', () => {
  const r = Recurrence.create({
    frequency: 'semanal',
    everyN: 2,
    endDate: new Date('2026-04-15T00:00:00.000Z'),
  });
  assert.deepEqual(occurrenceDates(r, anchor).map(iso), [
    '2026-03-01',
    '2026-03-15',
    '2026-03-29',
    '2026-04-12',
  ]);
});

test('diaria: passo de 1 dia, janela inclusiva na data final', () => {
  const r = Recurrence.create({ frequency: 'diaria', endDate: new Date('2026-03-04T00:00:00.000Z') });
  assert.deepEqual(occurrenceDates(r, anchor).map(iso), [
    '2026-03-01',
    '2026-03-02',
    '2026-03-03',
    '2026-03-04',
  ]);
});

test('mensal nao escorrega: 31/jan continua caindo no fim do mes', () => {
  const jan31 = new Date('2026-01-31T00:00:00.000Z');
  const r = Recurrence.create({ frequency: 'mensal', endDate: new Date('2026-04-30T00:00:00.000Z') });
  assert.deepEqual(occurrenceDates(r, jan31).map(iso), [
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
    '2026-04-30',
  ]);
});

test('trimestral: passo de 3 meses', () => {
  const r = Recurrence.create({ frequency: 'trimestral', endDate: new Date('2027-01-01T00:00:00.000Z') });
  assert.deepEqual(occurrenceDates(r, anchor).map(iso), [
    '2026-03-01',
    '2026-06-01',
    '2026-09-01',
    '2026-12-01',
  ]);
});

test('anual: passo de 12 meses', () => {
  const r = Recurrence.create({ frequency: 'anual', endDate: new Date('2029-06-01T00:00:00.000Z') });
  assert.deepEqual(occurrenceDates(r, anchor).map(iso), ['2026-03-01', '2027-03-01', '2028-03-01', '2029-03-01']);
});
