import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type ScenarioApplicationRepository } from '../../../src/app/scenario/scenario.application.repository.port.ts';
import { ScenarioApplication } from '../../../src/domain/scenario/scenario.application.entity.ts';

const application = (id: string, userId: string): ScenarioApplication =>
  ScenarioApplication.create({
    id,
    userId,
    scenarioId: 'scn1',
    snapshotId: 'snap1',
    appliedAt: new Date('2026-03-01T12:00:00.000Z'),
    createdIncomeIds: ['inc1', 'inc2'],
    createdFixedExpenseIds: ['fx1'],
  });

/**
 * Suite de contrato do `ScenarioApplicationRepository` (spec 002, RF-37, RF-38, RF-40).
 */
export function runScenarioApplicationRepositoryContract(
  label: string,
  createRepository: () => ScenarioApplicationRepository,
): void {
  test(`${label}: save + findById + findActiveByUser`, async () => {
    const repo = createRepository();
    await repo.save(application('app1', 'u1'));

    const byId = await repo.findById('u1', 'app1');
    assert.equal(byId?.scenarioId, 'scn1');
    assert.deepEqual([...(byId?.createdIncomeIds ?? [])], ['inc1', 'inc2']);

    const active = await repo.findActiveByUser('u1');
    assert.equal(active?.id, 'app1');
  });

  test(`${label}: nao vaza aplicacao de outro usuario`, async () => {
    const repo = createRepository();
    await repo.save(application('app1', 'u1'));

    assert.equal(await repo.findById('u2', 'app1'), null);
    assert.equal(await repo.findActiveByUser('u2'), null);
  });

  test(`${label}: findActiveByUser volta null quando nao ha aplicacao`, async () => {
    const repo = createRepository();
    assert.equal(await repo.findActiveByUser('u1'), null);
  });

  test(`${label}: delete respeita o escopo e encerra a aplicacao ativa`, async () => {
    const repo = createRepository();
    await repo.save(application('app1', 'u1'));

    await repo.delete('u2', 'app1');
    assert.ok(await repo.findById('u1', 'app1'), 'nao remove aplicacao de outro usuario');

    await repo.delete('u1', 'app1');
    assert.equal(await repo.findActiveByUser('u1'), null);
    await repo.delete('u1', 'app1'); // idempotente
  });
}
