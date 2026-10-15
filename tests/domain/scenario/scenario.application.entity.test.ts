import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScenarioApplication } from '../../../src/domain/scenario/scenario.application.entity.ts';
import { InvalidScenarioApplicationError } from '../../../src/domain/scenario/invalid.scenario.application.error.ts';

const base = () => ({
  id: '  app-1  ',
  userId: '  user-1  ',
  scenarioId: '  scn-1  ',
  snapshotId: '  snap-1  ',
  appliedAt: new Date('2026-03-01T12:00:00.000Z'),
  createdIncomeIds: ['inc-1', 'inc-2'],
  createdFixedExpenseIds: ['fx-1'],
});

test('cria, normaliza e copia as listas de ids', () => {
  const input = base();
  const application = ScenarioApplication.create(input);
  assert.equal(application.id, 'app-1');
  assert.equal(application.scenarioId, 'scn-1');
  assert.equal(application.snapshotId, 'snap-1');
  assert.deepEqual([...application.createdIncomeIds], ['inc-1', 'inc-2']);

  input.createdIncomeIds.push('inc-3');
  assert.equal(application.createdIncomeIds.length, 2);
});

test('aceita listas de ids vazias (aplicacao que nao criou lancamento)', () => {
  const application = ScenarioApplication.create({
    ...base(),
    createdIncomeIds: [],
    createdFixedExpenseIds: [],
  });
  assert.equal(application.createdIncomeIds.length, 0);
});

test('id/userId/scenarioId/snapshotId obrigatorios', () => {
  for (const field of ['id', 'userId', 'scenarioId', 'snapshotId'] as const) {
    assert.throws(
      () => ScenarioApplication.create({ ...base(), [field]: '  ' }),
      InvalidScenarioApplicationError,
      field,
    );
  }
});

test('appliedAt invalido e rejeitado', () => {
  assert.throws(
    () => ScenarioApplication.create({ ...base(), appliedAt: new Date('nao-e-data') }),
    InvalidScenarioApplicationError,
  );
});

test('id vazio dentro da lista e rejeitado', () => {
  assert.throws(
    () => ScenarioApplication.create({ ...base(), createdIncomeIds: ['ok', ''] }),
    InvalidScenarioApplicationError,
  );
});
