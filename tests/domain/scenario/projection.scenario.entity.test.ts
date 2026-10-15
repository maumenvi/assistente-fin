import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectionScenario } from '../../../src/domain/scenario/projection.scenario.entity.ts';
import { ScenarioAdjustment } from '../../../src/domain/scenario/scenario.adjustment.ts';
import { InvalidScenarioError } from '../../../src/domain/scenario/invalid.scenario.error.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

const adjustment = () =>
  ScenarioAdjustment.create({
    target: 'expense',
    mode: 'add',
    label: 'Aluguel novo',
    amountCents: 180_000,
    from: Month.create({ year: 2026, month: 10 }),
    to: Month.create({ year: 2027, month: 2 }),
  });

const base = () => ({
  id: '  scn-1  ',
  userId: '  user-1  ',
  name: '  Mudanca de casa  ',
  adjustments: [adjustment()],
  horizonMonths: 12,
});

test('cria e normaliza id/userId/name', () => {
  const scenario = ProjectionScenario.create(base());
  assert.equal(scenario.id, 'scn-1');
  assert.equal(scenario.userId, 'user-1');
  assert.equal(scenario.name, 'Mudanca de casa');
  assert.equal(scenario.updatedAt, null);
  assert.equal(scenario.adjustments.length, 1);
});

test('name obrigatorio e limitado a 120 chars', () => {
  assert.throws(() => ProjectionScenario.create({ ...base(), name: '   ' }), InvalidScenarioError);
  assert.throws(
    () => ProjectionScenario.create({ ...base(), name: 'x'.repeat(121) }),
    InvalidScenarioError,
  );
});

test('exige ao menos um ajuste', () => {
  assert.throws(
    () => ProjectionScenario.create({ ...base(), adjustments: [] }),
    InvalidScenarioError,
  );
});

test('horizonMonths deve ser inteiro entre 1 e 60', () => {
  assert.throws(() => ProjectionScenario.create({ ...base(), horizonMonths: 0 }), InvalidScenarioError);
  assert.throws(() => ProjectionScenario.create({ ...base(), horizonMonths: 61 }), InvalidScenarioError);
  assert.throws(() => ProjectionScenario.create({ ...base(), horizonMonths: 1.5 }), InvalidScenarioError);
});

test('fromPersistence aceita updatedAt e withUpdatedAt troca a versao', () => {
  const at = new Date('2026-02-02T00:00:00.000Z');
  const scenario = ProjectionScenario.fromPersistence({ ...base(), updatedAt: at });
  assert.equal(scenario.updatedAt?.getTime(), at.getTime());

  const restamped = scenario.withUpdatedAt(null);
  assert.equal(restamped.updatedAt, null);
  assert.equal(restamped.name, 'Mudanca de casa');
});

test('updatedAt invalido e rejeitado', () => {
  assert.throws(
    () => ProjectionScenario.fromPersistence({ ...base(), updatedAt: new Date('nao-e-data') }),
    InvalidScenarioError,
  );
});

test('a lista de ajustes e copiada (imutabilidade)', () => {
  const input = base();
  const scenario = ProjectionScenario.create(input);
  input.adjustments.push(adjustment());
  assert.equal(scenario.adjustments.length, 1);
});
