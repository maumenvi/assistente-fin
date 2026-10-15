import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCreditCardBillingPeriod } from '../../../src/domain/credit-card/credit.card.billing.period.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

test('fechamento dia 20, vencimento dia 5: vence no mes seguinte ao fechamento (spec 008 revisao)', () => {
  const period = calculateCreditCardBillingPeriod(20, 5, Month.create({ year: 2026, month: 1 }));

  // periodo: [20/dez, 19/jan] - fechamento de janeiro cai dia 20, entao o ciclo vai ate 19.
  assert.equal(period.from.toISOString(), '2025-12-20T00:00:00.000Z');
  assert.equal(period.to.toISOString(), '2026-01-19T00:00:00.000Z');
  assert.equal(period.dueDate.toISOString(), '2026-02-05T00:00:00.000Z');
});

test('fechamento dia 5, vencimento dia 20: vence no mesmo mes do fechamento', () => {
  const period = calculateCreditCardBillingPeriod(5, 20, Month.create({ year: 2026, month: 3 }));

  // periodo: [5/fev, 4/mar]
  assert.equal(period.from.toISOString(), '2026-02-05T00:00:00.000Z');
  assert.equal(period.to.toISOString(), '2026-03-04T00:00:00.000Z');
  assert.equal(period.dueDate.toISOString(), '2026-03-20T00:00:00.000Z');
});

test('lancamento no dia exato do fechamento pertence ao ciclo seguinte (RF-5a)', () => {
  // fechamento dia 10 de fevereiro: o ciclo de fevereiro vai ate 09/fev (inclusive),
  // o proprio dia 10 ja abre o ciclo seguinte (o `from` do ciclo de marco).
  const februaryCycle = calculateCreditCardBillingPeriod(10, 25, Month.create({ year: 2026, month: 2 }));
  const marchCycle = calculateCreditCardBillingPeriod(10, 25, Month.create({ year: 2026, month: 3 }));

  assert.equal(februaryCycle.to.toISOString(), '2026-02-09T00:00:00.000Z');
  assert.equal(marchCycle.from.toISOString(), '2026-02-10T00:00:00.000Z');
});

test('fechamento dia 31 em mes com menos dias: clampa pro ultimo dia do mes', () => {
  // Fevereiro/2026 (nao bissexto) tem 28 dias -> fechamento "dia 31" cai em 28/fev.
  const period = calculateCreditCardBillingPeriod(31, 10, Month.create({ year: 2026, month: 2 }));

  assert.equal(period.to.toISOString(), '2026-02-27T00:00:00.000Z');
  // Mes anterior (janeiro) tem 31 dias -> fechamento anterior cai no proprio dia 31.
  assert.equal(period.from.toISOString(), '2026-01-31T00:00:00.000Z');
});

test('vencimento dia 31 em mes com menos dias: clampa pro ultimo dia do mes', () => {
  // fechamento dia 1, vencimento "dia 31" - vence no mesmo mes do fechamento (31 > 1).
  // Fevereiro/2026 nao e bissexto -> ultimo dia e 28.
  const period = calculateCreditCardBillingPeriod(1, 31, Month.create({ year: 2026, month: 2 }));

  assert.equal(period.dueDate.toISOString(), '2026-02-28T00:00:00.000Z');
});

test('fechamento dia 31 cruzando fevereiro bissexto: clampa pra 29', () => {
  const period = calculateCreditCardBillingPeriod(31, 10, Month.create({ year: 2028, month: 2 }));

  assert.equal(period.to.toISOString(), '2028-02-28T00:00:00.000Z');
  const marchCycle = calculateCreditCardBillingPeriod(31, 10, Month.create({ year: 2028, month: 3 }));
  assert.equal(marchCycle.from.toISOString(), '2028-02-29T00:00:00.000Z');
});
