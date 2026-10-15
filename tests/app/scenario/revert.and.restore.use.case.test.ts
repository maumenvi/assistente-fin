import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApplyScenarioUseCase } from '../../../src/app/scenario/apply.scenario.use.case.ts';
import { RevertScenarioApplicationByRecordsUseCase } from '../../../src/app/scenario/revert.scenario.application.by.records.use.case.ts';
import { RestoreDataSnapshotUseCase } from '../../../src/app/scenario/restore.data.snapshot.use.case.ts';
import { ListDataSnapshotsUseCase } from '../../../src/app/scenario/list.data.snapshots.use.case.ts';
import { ExportDataSnapshotUseCase } from '../../../src/app/scenario/export.data.snapshot.use.case.ts';
import { DeleteDataSnapshotUseCase } from '../../../src/app/scenario/delete.data.snapshot.use.case.ts';
import { ScenarioApplicationNotFoundError } from '../../../src/domain/scenario/scenario.application.not.found.error.ts';
import { DataSnapshotNotFoundError } from '../../../src/domain/scenario/data.snapshot.not.found.error.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { ProjectionScenario } from '../../../src/domain/scenario/projection.scenario.entity.ts';
import { ScenarioAdjustment } from '../../../src/domain/scenario/scenario.adjustment.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const NOW = new Date('2026-03-15T12:00:00.000Z');

const setup = async () => {
  const db = new FakeDatabase();
  await db.users.save(
    User.create({
      id: 'u1',
      cpf: Cpf.create('52998224725'),
      email: Email.create('marco@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Marco',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }).verifyEmail(NOW).verifyPhone(NOW),
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
      recurrence: Recurrence.none(),
      categoryId: 'Trabalho',
    }),
  );
  await db.scenarios.save(
    ProjectionScenario.create({
      id: 'scn1',
      userId: 'u1',
      name: 'Bico',
      adjustments: [
        ScenarioAdjustment.create({
          target: 'income',
          mode: 'add',
          label: 'Bico',
          amountCents: 100_000,
          from: Month.create({ year: 2026, month: 4 }),
          to: Month.create({ year: 2026, month: 5 }),
        }),
      ],
      horizonMonths: 6,
    }),
  );

  const ids = new SequentialIdGenerator('gen');
  const apply = new ApplyScenarioUseCase(db, ids, new FixedClock(NOW));
  return {
    db,
    apply,
    revertByRecords: new RevertScenarioApplicationByRecordsUseCase(db),
    restore: new RestoreDataSnapshotUseCase(db),
    list: new ListDataSnapshotsUseCase(db.dataSnapshots),
    exportSnap: new ExportDataSnapshotUseCase(db.dataSnapshots),
    del: new DeleteDataSnapshotUseCase(db.dataSnapshots),
  };
};

test('revert by records apaga exatamente os lancamentos criados e o recibo; snapshot fica (RF-38)', async () => {
  const { db, apply, revertByRecords } = await setup();
  const applied = await apply.execute({ userId: 'u1', scenarioId: 'scn1' });

  const result = await revertByRecords.execute({
    userId: 'u1',
    applicationId: applied.application.id,
  });

  assert.equal(result.removedIncomeCount, 2);
  const incomes = await db.incomes.listByUser('u1');
  assert.equal(incomes.length, 1);
  assert.equal(incomes[0]?.id, 'inc-base');
  assert.equal(await db.scenarioApplications.findActiveByUser('u1'), null);
  assert.equal((await db.dataSnapshots.listByUser('u1')).length, 1, 'snapshot preservado');
});

test('revert by records de aplicacao inexistente vira ScenarioApplicationNotFoundError', async () => {
  const { revertByRecords } = await setup();
  await assert.rejects(
    revertByRecords.execute({ userId: 'u1', applicationId: 'nope' }),
    ScenarioApplicationNotFoundError,
  );
});

test('restore snapshot substitui todos os dados pelo estado do snapshot (CA-33a)', async () => {
  const { db, apply, restore } = await setup();
  const applied = await apply.execute({ userId: 'u1', scenarioId: 'scn1' });

  // mexe nos dados DEPOIS de aplicar
  await db.incomes.delete('u1', 'inc-base');
  await db.accounts.save(
    Account.create({ id: 'acc-nova', userId: 'u1', name: 'Nova', kind: 'wallet', openingBalance: Money.zero() }),
  );

  const report = await restore.execute({ userId: 'u1', snapshotId: applied.snapshotId });

  assert.equal(report.accounts, 1);
  assert.equal(report.incomes, 1);
  const accounts = await db.accounts.listByUser('u1');
  assert.deepEqual(accounts.map((a) => a.id).sort(), ['acc1']);
  const incomes = await db.incomes.listByUser('u1');
  assert.deepEqual(incomes.map((i) => i.id).sort(), ['inc-base']);
  assert.equal(await db.scenarioApplications.findActiveByUser('u1'), null, 'aplicacao ativa encerrada');
});

test('restore exige usuario verificado', async () => {
  const { db, apply, restore } = await setup();
  const applied = await apply.execute({ userId: 'u1', scenarioId: 'scn1' });

  const unverified = (await db.users.findById('u1'))!;
  // remove a verificacao regravando um User sem os *VerifiedAt
  await db.users.save(
    User.fromPersistence({
      id: unverified.id,
      cpf: unverified.cpf,
      email: unverified.email,
      phone: unverified.phone,
      name: unverified.name,
      createdAt: unverified.createdAt,
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      updatedAt: unverified.updatedAt,
    }),
  );

  await assert.rejects(
    restore.execute({ userId: 'u1', snapshotId: applied.snapshotId }),
    UserNotVerifiedError,
  );
});

test('restore de snapshot inexistente vira DataSnapshotNotFoundError', async () => {
  const { restore } = await setup();
  await assert.rejects(
    restore.execute({ userId: 'u1', snapshotId: 'nope' }),
    DataSnapshotNotFoundError,
  );
});

test('list / export / delete de snapshots', async () => {
  const { db, apply, list, exportSnap, del } = await setup();
  const applied = await apply.execute({ userId: 'u1', scenarioId: 'scn1' });

  const listed = await list.execute({ userId: 'u1' });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.id, applied.snapshotId);

  const exported = await exportSnap.execute({ userId: 'u1', snapshotId: applied.snapshotId });
  assert.equal(exported.originScenarioId, 'scn1');
  assert.match(exported.payload, /"kind":"header"/);
  assert.deepEqual(exported.recordCounts, { account: 1, income: 1 });

  const removed = await del.execute({ userId: 'u1', snapshotId: applied.snapshotId });
  assert.equal(removed.id, applied.snapshotId);
  assert.equal((await db.dataSnapshots.listByUser('u1')).length, 0);
  // excluir nao mexe nos dados atuais
  assert.ok(await db.accounts.findById('u1', 'acc1'));
});
