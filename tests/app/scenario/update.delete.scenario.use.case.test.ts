import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveScenarioUseCase } from '../../../src/app/scenario/save.scenario.use.case.ts';
import { UpdateScenarioUseCase } from '../../../src/app/scenario/update.scenario.use.case.ts';
import { DeleteScenarioUseCase } from '../../../src/app/scenario/delete.scenario.use.case.ts';
import { GetActiveScenarioApplicationUseCase } from '../../../src/app/scenario/get.active.scenario.application.use.case.ts';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { ScenarioNotFoundError } from '../../../src/domain/scenario/scenario.not.found.error.ts';
import { ScenarioApplication } from '../../../src/domain/scenario/scenario.application.entity.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { FakeScenarioRepository } from '../../../src/database/fake/scenario.repository.fake.ts';
import { FakeScenarioApplicationRepository } from '../../../src/database/fake/scenario.application.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const adjustment = (over: Record<string, unknown> = {}) => ({
  target: 'expense',
  mode: 'add',
  label: 'Aluguel',
  amountCents: 180_000,
  from: { year: 2026, month: 10 },
  to: { year: 2027, month: 2 },
  ...over,
});

const makeUseCases = async () => {
  const users = new FakeUserRepository();
  const scenarios = new FakeScenarioRepository();
  const applications = new FakeScenarioApplicationRepository();
  await users.save(
    User.create({
      id: 'u1',
      cpf: Cpf.create('52998224725'),
      email: Email.create('marco@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Marco',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
  );
  const save = new SaveScenarioUseCase(scenarios, users, new SequentialIdGenerator('scn'));
  const saved = await save.execute({ userId: 'u1', name: 'Base', adjustments: [adjustment()] });
  return {
    scenarios,
    applications,
    saved,
    update: new UpdateScenarioUseCase(scenarios),
    del: new DeleteScenarioUseCase(scenarios),
    active: new GetActiveScenarioApplicationUseCase(applications),
  };
};

test('update mescla os campos enviados e preserva o resto (RF-36)', async () => {
  const { update, saved } = await makeUseCases();

  const updated = await update.execute({
    userId: 'u1',
    scenarioId: saved.id,
    name: 'Renomeado',
    horizonMonths: 24,
  });

  assert.equal(updated.name, 'Renomeado');
  assert.equal(updated.horizonMonths, 24);
  assert.equal(updated.adjustments.length, 1); // preservado
});

test('update com expectedUpdatedAt desatualizado vira StaleDataError (RF-31)', async () => {
  const { update, saved, scenarios } = await makeUseCases();
  const v1 = await scenarios.findById('u1', saved.id);
  assert.ok(v1?.updatedAt);

  await update.execute({ userId: 'u1', scenarioId: saved.id, name: 'Primeiro' });

  await assert.rejects(
    update.execute({
      userId: 'u1',
      scenarioId: saved.id,
      name: 'Segundo',
      expectedUpdatedAt: v1.updatedAt.toISOString(),
    }),
    StaleDataError,
  );
});

test('update de cenario inexistente vira ScenarioNotFoundError', async () => {
  const { update } = await makeUseCases();
  await assert.rejects(
    update.execute({ userId: 'u1', scenarioId: 'nope', name: 'x' }),
    ScenarioNotFoundError,
  );
});

test('delete remove e devolve o cenario; segunda vez vira ScenarioNotFoundError', async () => {
  const { del, saved, scenarios } = await makeUseCases();

  const removed = await del.execute({ userId: 'u1', scenarioId: saved.id });
  assert.equal(removed.id, saved.id);
  assert.equal(await scenarios.findById('u1', saved.id), null);

  await assert.rejects(del.execute({ userId: 'u1', scenarioId: saved.id }), ScenarioNotFoundError);
});

test('getActiveScenarioApplication devolve null sem aplicacao e o recibo quando ha (RF-40)', async () => {
  const { active, applications } = await makeUseCases();

  assert.equal(await active.execute({ userId: 'u1' }), null);

  await applications.save(
    ScenarioApplication.create({
      id: 'app1',
      userId: 'u1',
      scenarioId: 'scn-1',
      snapshotId: 'snap1',
      appliedAt: new Date('2026-03-01T12:00:00.000Z'),
      createdIncomeIds: ['inc1'],
      createdFixedExpenseIds: [],
    }),
  );

  const found = await active.execute({ userId: 'u1' });
  assert.equal(found?.id, 'app1');
  assert.equal(found?.scenarioId, 'scn-1');
});
