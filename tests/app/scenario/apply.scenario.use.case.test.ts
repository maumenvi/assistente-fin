import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApplyScenarioUseCase } from '../../../src/app/scenario/apply.scenario.use.case.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { ScenarioNotFoundError } from '../../../src/domain/scenario/scenario.not.found.error.ts';
import { ScenarioApplicationExistsError } from '../../../src/domain/scenario/scenario.application.exists.error.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { ProjectionScenario } from '../../../src/domain/scenario/projection.scenario.entity.ts';
import { ScenarioAdjustment } from '../../../src/domain/scenario/scenario.adjustment.ts';
import { ScenarioApplication } from '../../../src/domain/scenario/scenario.application.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';
import { monthlyFrom } from '../../support/recurrence.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const NOW = new Date('2026-03-15T12:00:00.000Z'); // marco/2026

const adjustment = (amountCents: number, mode: 'add' | 'replace' = 'add') =>
  ScenarioAdjustment.create({
    target: 'income',
    mode,
    label: 'Ajuste',
    amountCents,
    from: Month.create({ year: 2026, month: 4 }),
    to: Month.create({ year: 2026, month: 5 }),
  });

const makeSetup = async (options: { verified?: boolean; scenarioAmount?: number } = {}) => {
  const db = new FakeDatabase();
  let user = User.create({
    id: 'u1',
    cpf: Cpf.create('52998224725'),
    email: Email.create('marco@exemplo.com'),
    phone: Phone.create('11987654321'),
    name: 'Marco',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
  if (options.verified !== false) user = user.verifyEmail(NOW).verifyPhone(NOW);
  await db.users.save(user);
  await db.categories.save(
    Category.create({ id: 'cat-trabalho', userId: 'u1', name: CategoryName.create('Trabalho') }),
  );

  await db.accounts.save(
    Account.create({ id: 'acc1', userId: 'u1', name: 'Conta', kind: 'checking', openingBalance: Money.zero() }),
  );
  await db.incomes.save(
    Income.create({
      id: 'inc-base',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(500_000),
      source: 'Salario',
      recurrence: monthlyFrom('2026-01-05T00:00:00.000Z'),
      categoryId: 'cat-trabalho',
    }),
  );

  await db.scenarios.save(
    ProjectionScenario.create({
      id: 'scn1',
      userId: 'u1',
      name: 'Bico de abril e maio',
      adjustments: [adjustment(options.scenarioAmount ?? 100_000)],
      horizonMonths: 6,
    }),
  );

  return {
    db,
    useCase: new ApplyScenarioUseCase(db, new SequentialIdGenerator('gen'), new FixedClock(NOW)),
  };
};

test('aplica: grava snapshot, cria ganhos nos meses de aumento e o recibo (RF-37)', async () => {
  const { db, useCase } = await makeSetup();

  const result = await useCase.execute({ userId: 'u1', scenarioId: 'scn1' });

  // snapshot gravado
  const snapshots = await db.dataSnapshots.listByUser('u1');
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.id, result.snapshotId);
  assert.equal(snapshots[0]?.originScenarioId, 'scn1');
  assert.deepEqual(snapshots[0]?.recordCounts, { category: 1, account: 1, income: 1 });

  // ganhos de ajuste criados para abril e maio
  const adjustmentCategory = await db.categories.findByName(
    'u1',
    CategoryName.create('ajuste de cenario'),
  );
  const adjustmentIncomes = (await db.incomes.listByUser('u1')).filter(
    (income) => income.categoryId === adjustmentCategory?.id,
  );
  assert.equal(adjustmentIncomes.length, 2);
  assert.equal(result.createdIncomeCount, 2);
  assert.deepEqual(result.skippedMonths, []);
  assert.ok(adjustmentIncomes.every((income) => income.amount.cents === 100_000));

  // recibo / aplicacao ativa
  const active = await db.scenarioApplications.findActiveByUser('u1');
  assert.equal(active?.id, result.application.id);
  assert.equal(active?.snapshotId, result.snapshotId);
  assert.equal(active?.createdIncomeIds.length, 2);
});

test('Income de ajuste criado sem accountId; nenhuma Transaction e criada (spec 012, RF-12)', async () => {
  const { db, useCase } = await makeSetup();

  await useCase.execute({ userId: 'u1', scenarioId: 'scn1' });

  const adjustmentCategory = await db.categories.findByName(
    'u1',
    CategoryName.create('ajuste de cenario'),
  );
  const adjustmentIncomes = (await db.incomes.listByUser('u1')).filter(
    (income) => income.categoryId === adjustmentCategory?.id,
  );
  assert.ok(adjustmentIncomes.length > 0);
  assert.ok(
    adjustmentIncomes.every((income) => income.accountId === null),
    'nenhum Income de cenario tem accountId (RF-12, sem vinculo com conta real)',
  );
  assert.equal(
    (await db.transactions.listByUser('u1')).length,
    0,
    'aplicar cenario nunca cria Transaction (nao aparece no Extrato/Dashboard)',
  );
});

test('meses de reducao liquida nao sao materializados, voltam em skippedMonths (RF-37a)', async () => {
  const { db, useCase } = await makeSetup({ scenarioAmount: -100_000 });

  const result = await useCase.execute({ userId: 'u1', scenarioId: 'scn1' });

  assert.equal(result.createdIncomeCount, 0);
  assert.deepEqual([...result.skippedMonths].sort(), ['2026-04', '2026-05']);
  assert.equal(
    (await db.incomes.listByUser('u1')).filter(
      (i) => i.source.startsWith('Cenario:'),
    ).length,
    0,
  );
  // mesmo sem materializar nada, o snapshot e o recibo existem
  assert.equal((await db.dataSnapshots.listByUser('u1')).length, 1);
  assert.ok(await db.scenarioApplications.findActiveByUser('u1'));
});

test('usuario nao verificado vira UserNotVerifiedError', async () => {
  const { useCase } = await makeSetup({ verified: false });
  await assert.rejects(
    useCase.execute({ userId: 'u1', scenarioId: 'scn1' }),
    UserNotVerifiedError,
  );
});

test('cenario inexistente vira ScenarioNotFoundError', async () => {
  const { useCase } = await makeSetup();
  await assert.rejects(
    useCase.execute({ userId: 'u1', scenarioId: 'nope' }),
    ScenarioNotFoundError,
  );
});

test('segunda aplicacao com uma ja ativa vira ScenarioApplicationExistsError', async () => {
  const { db, useCase } = await makeSetup();
  await db.scenarioApplications.save(
    ScenarioApplication.create({
      id: 'app-antiga',
      userId: 'u1',
      scenarioId: 'scn1',
      snapshotId: 'snap-antiga',
      appliedAt: NOW,
      createdIncomeIds: [],
      createdFixedExpenseIds: [],
    }),
  );

  await assert.rejects(
    useCase.execute({ userId: 'u1', scenarioId: 'scn1' }),
    ScenarioApplicationExistsError,
  );
});
