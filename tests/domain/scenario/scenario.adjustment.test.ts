import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScenarioAdjustment } from '../../../src/domain/scenario/scenario.adjustment.ts';
import { InvalidScenarioError } from '../../../src/domain/scenario/invalid.scenario.error.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

const jan = Month.create({ year: 2026, month: 1 });
const abr = Month.create({ year: 2026, month: 4 });

const base = () => ({
  target: 'income' as const,
  mode: 'add' as const,
  label: '  Salario extra  ',
  amountCents: 100_000,
  from: jan,
  to: abr,
});

test('cria e normaliza o label', () => {
  const adjustment = ScenarioAdjustment.create(base());
  assert.equal(adjustment.label, 'Salario extra');
  assert.equal(adjustment.amountCents, 100_000);
});

test('mode "add" aceita valor negativo (reducao)', () => {
  const adjustment = ScenarioAdjustment.create({ ...base(), amountCents: -50_000 });
  assert.equal(adjustment.amountCents, -50_000);
});

test('mode "add" com valor 0 e invalido', () => {
  assert.throws(() => ScenarioAdjustment.create({ ...base(), amountCents: 0 }), InvalidScenarioError);
});

test('mode "replace" nao aceita valor negativo', () => {
  assert.throws(
    () => ScenarioAdjustment.create({ ...base(), mode: 'replace', amountCents: -1 }),
    InvalidScenarioError,
  );
  assert.equal(
    ScenarioAdjustment.create({ ...base(), mode: 'replace', amountCents: 0 }).amountCents,
    0,
  );
});

test('target e mode desconhecidos sao invalidos', () => {
  assert.throws(
    () => ScenarioAdjustment.create({ ...base(), target: 'saldo' as never }),
    InvalidScenarioError,
  );
  assert.throws(
    () => ScenarioAdjustment.create({ ...base(), mode: 'multiplicar' as never }),
    InvalidScenarioError,
  );
});

test('label vazio ou longo demais e invalido', () => {
  assert.throws(() => ScenarioAdjustment.create({ ...base(), label: '   ' }), InvalidScenarioError);
  assert.throws(
    () => ScenarioAdjustment.create({ ...base(), label: 'x'.repeat(121) }),
    InvalidScenarioError,
  );
});

test('amountCents fracionado e invalido', () => {
  assert.throws(
    () => ScenarioAdjustment.create({ ...base(), amountCents: 10.5 }),
    InvalidScenarioError,
  );
});

test('from depois de to e invalido; from == to e valido', () => {
  assert.throws(
    () => ScenarioAdjustment.create({ ...base(), from: abr, to: jan }),
    InvalidScenarioError,
  );
  assert.doesNotThrow(() => ScenarioAdjustment.create({ ...base(), from: jan, to: jan }));
});

test('appliesTo cobre o intervalo inclusive nas pontas', () => {
  const adjustment = ScenarioAdjustment.create(base());
  assert.equal(adjustment.appliesTo(jan), true);
  assert.equal(adjustment.appliesTo(abr), true);
  assert.equal(adjustment.appliesTo(Month.create({ year: 2026, month: 2 })), true);
  assert.equal(adjustment.appliesTo(Month.create({ year: 2025, month: 12 })), false);
  assert.equal(adjustment.appliesTo(Month.create({ year: 2026, month: 5 })), false);
});
