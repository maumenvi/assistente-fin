import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { InvalidRecurrenceError } from '../../../src/domain/shared/invalid.recurrence.error.ts';

const end = new Date('2026-08-31T00:00:00.000Z');

test('create usa everyN 1 por default', () => {
  const recurrence = Recurrence.create({ frequency: 'mensal', endDate: end });
  assert.equal(recurrence.frequency, 'mensal');
  assert.equal(recurrence.everyN, 1);
  assert.equal(recurrence.endDate?.getTime(), end.getTime());
});

test('create aceita everyN explicito (quinzenal = semanal a cada 2)', () => {
  const recurrence = Recurrence.create({ frequency: 'semanal', everyN: 2, endDate: end });
  assert.equal(recurrence.everyN, 2);
});

test('none() e atalho para nao-repete, sem data final', () => {
  const recurrence = Recurrence.none();
  assert.equal(recurrence.frequency, 'nao-repete');
  assert.equal(recurrence.everyN, 1);
  assert.equal(recurrence.endDate, null);
  assert.equal(recurrence.repeats(), false);
});

test('rejeita frequency desconhecida e everyN invalido', () => {
  assert.throws(
    // @ts-expect-error frequency invalida de proposito
    () => Recurrence.create({ frequency: 'daily', endDate: end }),
    InvalidRecurrenceError,
  );
  assert.throws(() => Recurrence.create({ frequency: 'mensal', everyN: 0, endDate: end }), InvalidRecurrenceError);
  assert.throws(() => Recurrence.create({ frequency: 'mensal', everyN: 1.5, endDate: end }), InvalidRecurrenceError);
});

test('"nao-repete" nao pode ter data final; frequencia que repete exige data final', () => {
  assert.throws(() => Recurrence.create({ frequency: 'nao-repete', endDate: end }), InvalidRecurrenceError);
  assert.throws(() => Recurrence.create({ frequency: 'mensal' }), InvalidRecurrenceError);
  assert.throws(
    () => Recurrence.create({ frequency: 'mensal', endDate: new Date('invalido') }),
    InvalidRecurrenceError,
  );
});

test('withEndDate mantem frequencia e everyN', () => {
  const other = new Date('2027-01-01T00:00:00.000Z');
  const moved = Recurrence.create({ frequency: 'semanal', everyN: 2, endDate: end }).withEndDate(other);
  assert.equal(moved.frequency, 'semanal');
  assert.equal(moved.everyN, 2);
  assert.equal(moved.endDate?.getTime(), other.getTime());
});

test('equals compara frequency, everyN e endDate', () => {
  const a = Recurrence.create({ frequency: 'anual', everyN: 2, endDate: end });
  assert.ok(a.equals(Recurrence.create({ frequency: 'anual', everyN: 2, endDate: new Date(end) })));
  assert.equal(a.equals(Recurrence.create({ frequency: 'anual', everyN: 1, endDate: end })), false);
  assert.ok(Recurrence.none().equals(Recurrence.none()));
});
