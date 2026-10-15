import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Month } from '../../../src/domain/shared/month.value.object.ts';
import { InvalidMonthError } from '../../../src/domain/shared/invalid.month.error.ts';

test('create aceita ano/mes validos', () => {
  const month = Month.create({ year: 2026, month: 1 });
  assert.equal(month.year, 2026);
  assert.equal(month.month, 1);
});

test('fromDate extrai ano/mes UTC de uma Date', () => {
  const month = Month.fromDate(new Date('2026-03-15T12:00:00.000Z'));
  assert.equal(month.year, 2026);
  assert.equal(month.month, 3);
});

test('rejeita ano/mes fora dos limites', () => {
  assert.throws(() => Month.create({ year: 1969, month: 1 }), InvalidMonthError);
  assert.throws(() => Month.create({ year: 2026, month: 0 }), InvalidMonthError);
  assert.throws(() => Month.create({ year: 2026, month: 13 }), InvalidMonthError);
  assert.throws(() => Month.create({ year: 2026.5, month: 1 }), InvalidMonthError);
});

test('equals e compare', () => {
  const jan = Month.create({ year: 2026, month: 1 });
  const feb = Month.create({ year: 2026, month: 2 });

  assert.ok(jan.equals(Month.create({ year: 2026, month: 1 })));
  assert.equal(jan.compare(feb), -1);
  assert.equal(feb.compare(jan), 1);
  assert.equal(jan.compare(jan), 0);
});

test('next cruza o ano de dezembro pra janeiro', () => {
  const dec = Month.create({ year: 2026, month: 12 });
  const next = dec.next();
  assert.equal(next.year, 2027);
  assert.equal(next.month, 1);
});

test('previous cruza o ano de janeiro pra dezembro', () => {
  const jan = Month.create({ year: 2026, month: 1 });
  const previous = jan.previous();
  assert.equal(previous.year, 2025);
  assert.equal(previous.month, 12);
});

test('previous lanca InvalidMonthError ao cruzar o limite minimo', () => {
  const jan1970 = Month.create({ year: 1970, month: 1 });
  assert.throws(() => jan1970.previous(), InvalidMonthError);
});

test('toString formata AAAA-MM', () => {
  assert.equal(Month.create({ year: 2026, month: 1 }).toString(), '2026-01');
  assert.equal(Month.create({ year: 2026, month: 12 }).toString(), '2026-12');
});
