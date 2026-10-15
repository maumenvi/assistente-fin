import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePurchaseImpact } from '../../../src/domain/simulation/purchase.simulation.ts';
import { PurchaseSimulation } from '../../../src/domain/simulation/simulation.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

const base = () => ({
  id: 'sim-1',
  userId: 'user-1',
  amount: Money.fromCents(100_000),
  date: new Date('2026-03-10T00:00:00.000Z'),
  categoryId: 'Eletronicos',
  payment: 'credit-card' as const,
  installments: 1,
  recurrence: Recurrence.none(),
  accountId: 'acc-1',
});

test('a vista (CA-8): um unico impacto, no mes da compra, valor cheio', () => {
  const simulation = PurchaseSimulation.create(base());
  const impacts = calculatePurchaseImpact(simulation);

  assert.equal(impacts.length, 1);
  assert.ok(impacts[0]!.month.equals(Month.fromDate(simulation.date)));
  assert.equal(impacts[0]!.amount.cents, 100_000);
});

test('parcelada (CA-9): uma parcela por mes a partir do mes da compra, soma bate com o total', () => {
  const simulation = PurchaseSimulation.create({ ...base(), amount: Money.fromCents(10_001), installments: 3 });
  const impacts = calculatePurchaseImpact(simulation);

  assert.equal(impacts.length, 3);
  const purchaseMonth = Month.fromDate(simulation.date);
  assert.ok(impacts[0]!.month.equals(purchaseMonth));
  assert.ok(impacts[1]!.month.equals(purchaseMonth.next()));
  assert.ok(impacts[2]!.month.equals(purchaseMonth.next().next()));

  const total = impacts.reduce((sum, impact) => sum + impact.amount.cents, 0);
  assert.equal(total, 10_001);
  // resto (1 centavo) vai na primeira parcela
  assert.equal(impacts[0]!.amount.cents, 3_334);
  assert.equal(impacts[1]!.amount.cents, 3_334);
  assert.equal(impacts[2]!.amount.cents, 3_333);
});

test('recorrente (CA-10): repete o valor cheio em todo mes ativo, dentro do horizonte padrao de 12 meses', () => {
  const simulation = PurchaseSimulation.create({
    ...base(),
    recurrence: Recurrence.create({ frequency: 'mensal', endDate: new Date('2027-03-10T00:00:00.000Z') }),
  });
  const impacts = calculatePurchaseImpact(simulation);

  assert.equal(impacts.length, 12);
  for (const impact of impacts) {
    assert.equal(impact.amount.cents, 100_000);
  }
  const purchaseMonth = Month.fromDate(simulation.date);
  assert.ok(impacts[0]!.month.equals(purchaseMonth));
  assert.ok(impacts[11]!.month.equals(purchaseMonth.next().next().next().next().next().next().next().next().next().next().next()));
});

test('recorrente respeita o everyN e um horizonte customizado', () => {
  const simulation = PurchaseSimulation.create({
    ...base(),
    recurrence: Recurrence.create({
      frequency: 'mensal',
      everyN: 2,
      endDate: new Date('2026-09-10T00:00:00.000Z'),
    }),
  });
  const impacts = calculatePurchaseImpact(simulation, { horizonMonths: 6 });

  // meses 0,2,4 de um horizonte de 6 (0..5) -> 3 ocorrencias
  assert.equal(impacts.length, 3);
});

test('recorrente anual so ocorre no mesmo mes-ancora todo ano, dentro do horizonte', () => {
  const simulation = PurchaseSimulation.create({
    ...base(),
    recurrence: Recurrence.create({ frequency: 'anual', endDate: new Date('2028-03-10T00:00:00.000Z') }),
  });
  const impacts = calculatePurchaseImpact(simulation, { horizonMonths: 24 });

  assert.equal(impacts.length, 2);
});
