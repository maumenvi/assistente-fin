import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maxEndDate, isWithinMaxReach } from '../../../src/domain/shared/recurrence.reach.ts';

const at = (iso: string) => new Date(iso);

test('maxEndDate: teto de cada frequencia a partir da ancora', () => {
  const anchor = at('2026-03-10T00:00:00.000Z');

  assert.equal(maxEndDate('diaria', anchor).toISOString(), '2026-04-09T00:00:00.000Z');
  assert.equal(maxEndDate('semanal', anchor).toISOString(), '2026-12-15T00:00:00.000Z');
  assert.equal(maxEndDate('mensal', anchor).toISOString(), '2027-03-10T00:00:00.000Z');
  assert.equal(maxEndDate('trimestral', anchor).toISOString(), '2027-03-10T00:00:00.000Z');
  assert.equal(maxEndDate('semestral', anchor).toISOString(), '2028-03-10T00:00:00.000Z');
  assert.equal(maxEndDate('anual', anchor).toISOString(), '2038-03-10T00:00:00.000Z');
});

test('maxEndDate: "nao-repete" nao tem alcance', () => {
  assert.throws(() => maxEndDate('nao-repete', at('2026-03-10T00:00:00.000Z')), /nao tem alcance/);
});

test('isWithinMaxReach: endDate no teto passa, um dia alem falha', () => {
  const anchor = at('2026-03-10T00:00:00.000Z');

  assert.equal(isWithinMaxReach('mensal', anchor, at('2027-03-10T00:00:00.000Z')), true);
  assert.equal(isWithinMaxReach('mensal', anchor, at('2027-03-11T00:00:00.000Z')), false);
  assert.equal(isWithinMaxReach('diaria', anchor, at('2026-04-09T00:00:00.000Z')), true);
  assert.equal(isWithinMaxReach('diaria', anchor, at('2026-04-10T00:00:00.000Z')), false);
});

test('isWithinMaxReach: endDate precisa ser posterior a ancora', () => {
  const anchor = at('2026-03-10T00:00:00.000Z');

  assert.equal(isWithinMaxReach('mensal', anchor, anchor), false);
  assert.equal(isWithinMaxReach('mensal', anchor, at('2026-03-09T00:00:00.000Z')), false);
  assert.equal(isWithinMaxReach('mensal', anchor, at('2026-06-10T00:00:00.000Z')), true);
});

test('isWithinMaxReach: "nao-repete" nunca cabe', () => {
  const anchor = at('2026-03-10T00:00:00.000Z');
  assert.equal(isWithinMaxReach('nao-repete', anchor, at('2026-04-10T00:00:00.000Z')), false);
});
