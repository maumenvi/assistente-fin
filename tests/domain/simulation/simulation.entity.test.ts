import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PurchaseSimulation } from '../../../src/domain/simulation/simulation.entity.ts';
import { InvalidSimulationError } from '../../../src/domain/simulation/invalid.simulation.error.ts';
import { SimulationAlreadyApprovedError } from '../../../src/domain/simulation/simulation.already.approved.error.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';

const base = () => ({
  id: 'sim-1',
  userId: 'user-1',
  amount: Money.fromCents(100_000),
  date: new Date('2026-01-05T00:00:00.000Z'),
  categoryId: '  Eletronicos  ',
  payment: 'credit-card' as const,
  installments: 1,
  recurrence: Recurrence.none(),
  accountId: 'acc-1',
});

test('create nasce nao aprovada e normaliza category (RF-9)', () => {
  const simulation = PurchaseSimulation.create(base());

  assert.equal(simulation.approvedAt, null);
  assert.equal(simulation.categoryId, 'Eletronicos');
  assert.equal(simulation.isInstallment(), false);
  assert.equal(simulation.isRecurring(), false);
});

test('isInstallment/isRecurring refletem os campos', () => {
  const installment = PurchaseSimulation.create({ ...base(), installments: 3 });
  assert.equal(installment.isInstallment(), true);

  const recurring = PurchaseSimulation.create({
    ...base(),
    recurrence: Recurrence.create({ frequency: 'mensal', endDate: new Date('2026-12-05T00:00:00.000Z') }),
  });
  assert.equal(recurring.isRecurring(), true);
});

test('rejeita parcelado e recorrente ao mesmo tempo (mutuamente exclusivos)', () => {
  assert.throws(
    () =>
      PurchaseSimulation.create({
        ...base(),
        installments: 3,
        recurrence: Recurrence.create({ frequency: 'mensal', endDate: new Date('2026-12-05T00:00:00.000Z') }),
      }),
    InvalidSimulationError,
  );
});

test('create rejeita campos invalidos', () => {
  assert.throws(() => PurchaseSimulation.create({ ...base(), id: '' }), InvalidSimulationError);
  assert.throws(
    () => PurchaseSimulation.create({ ...base(), amount: Money.zero() }),
    InvalidSimulationError,
  );
  assert.throws(
    // @ts-expect-error payment invalido de proposito
    () => PurchaseSimulation.create({ ...base(), payment: 'boleto' }),
    InvalidSimulationError,
  );
  assert.throws(
    () => PurchaseSimulation.create({ ...base(), installments: 0 }),
    InvalidSimulationError,
  );
  assert.throws(
    () => PurchaseSimulation.create({ ...base(), installments: 1.5 }),
    InvalidSimulationError,
  );
  assert.throws(
    () => PurchaseSimulation.create({ ...base(), categoryId: '   ' }),
    InvalidSimulationError,
  );
  assert.throws(
    () => PurchaseSimulation.create({ ...base(), accountId: '' }),
    InvalidSimulationError,
  );
});

test('approve marca aprovada; aprovar de novo lanca SimulationAlreadyApprovedError', () => {
  const simulation = PurchaseSimulation.create(base());
  const now = new Date('2026-01-06T00:00:00.000Z');

  const approved = simulation.approve(now);
  assert.equal(approved.approvedAt, now);
  assert.equal(simulation.approvedAt, null, 'nao muta o original');

  assert.throws(() => approved.approve(now), SimulationAlreadyApprovedError);
});

test('fromPersistence reconstroi (inclusive ja aprovada) reaplicando as invariantes', () => {
  const approvedAt = new Date('2026-01-06T00:00:00.000Z');
  const simulation = PurchaseSimulation.fromPersistence({ ...base(), approvedAt });
  assert.equal(simulation.approvedAt, approvedAt);

  assert.throws(
    () => PurchaseSimulation.fromPersistence({ ...base(), id: '', approvedAt: null }),
    InvalidSimulationError,
  );
});
