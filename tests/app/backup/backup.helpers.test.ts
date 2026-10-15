import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeBackup } from '../../../src/app/backup/serialize.backup.ts';
import { parseNdjson } from '../../../src/app/backup/parse.ndjson.ts';
import { streamBackupRecords } from '../../../src/app/backup/stream.backup.records.ts';
import { importBackupRecords } from '../../../src/app/backup/import.backup.records.ts';
import { wipeUserFinancialData } from '../../../src/app/backup/wipe.user.financial.data.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { type BackupRecord } from '../../../src/app/shared/backup.record.schema.ts';

const seed = async () => {
  const db = new FakeDatabase();
  await db.users.save(
    User.create({
      id: 'u1',
      cpf: Cpf.create('52998224725'),
      email: Email.create('marco@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Marco',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
  );
  await db.categories.save(
    Category.create({ id: 'cat-trabalho', userId: 'u1', name: CategoryName.create('Trabalho') }),
  );
  await db.accounts.save(
    Account.create({ id: 'acc1', userId: 'u1', name: 'Conta', kind: 'checking', openingBalance: Money.zero() }),
  );
  await db.incomes.save(
    Income.create({
      id: 'inc1',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(500_000),
      source: 'Salario',
      recurrence: Recurrence.none(),
      categoryId: 'cat-trabalho',
    }),
  );
  return db;
};

test('serializeBackup produz NDJSON + contagem por tipo (sem header)', async () => {
  const db = await seed();
  const { payload, recordCounts } = await serializeBackup(
    streamBackupRecords(db, 'u1', new Date('2026-03-01T00:00:00.000Z')),
  );

  const lines = payload.trimEnd().split('\n');
  assert.equal(JSON.parse(lines[0]!).kind, 'header');
  assert.deepEqual(recordCounts, { category: 1, account: 1, income: 1 });
});

test('parseNdjson e o inverso: roundtrip serialize -> parse -> import', async () => {
  const source = await seed();
  const { payload } = await serializeBackup(
    streamBackupRecords(source, 'u1', new Date('2026-03-01T00:00:00.000Z')),
  );

  const target = new FakeDatabase();
  await target.users.save((await source.users.findById('u1'))!.withUpdatedAt(null));

  const report = await importBackupRecords(target, 'u1', parseNdjson(payload));

  assert.equal(report.categories, 1);
  assert.equal(report.accounts, 1);
  assert.equal(report.incomes, 1);
  assert.equal((await target.accounts.listByUser('u1')).length, 1);
  assert.equal((await target.incomes.listByUser('u1')).length, 1);
});

test('parseNdjson ignora linhas em branco', () => {
  const parsed = parseNdjson('{"a":1}\n\n  \n{"b":2}\n');
  assert.deepEqual(parsed, [{ a: 1 }, { b: 2 }]);
});

test('wipeUserFinancialData apaga o dado do usuario e preserva o User', async () => {
  const db = await seed();
  await wipeUserFinancialData(db, 'u1');

  assert.equal((await db.accounts.listByUser('u1')).length, 0);
  assert.equal((await db.incomes.listByUser('u1')).length, 0);
  assert.ok(await db.users.findById('u1'), 'User intacto');
});

test('wipeUserFinancialData nao toca dado de outro usuario', async () => {
  const db = await seed();
  await db.users.save(
    User.create({
      id: 'u2',
      cpf: Cpf.create('15350946056'),
      email: Email.create('outro@exemplo.com'),
      phone: Phone.create('11911112222'),
      name: 'Outro',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
  );
  await db.accounts.save(
    Account.create({ id: 'acc2', userId: 'u2', name: 'C2', kind: 'checking', openingBalance: Money.zero() }),
  );

  await wipeUserFinancialData(db, 'u1');
  assert.equal((await db.accounts.listByUser('u2')).length, 1);
});

const headerless: BackupRecord[] = [];
test('serializeBackup de stream vazio (so header) tem recordCounts vazio', async () => {
  async function* onlyHeader(): AsyncGenerator<BackupRecord> {
    yield { kind: 'header', schemaVersion: 2, userId: 'u1', exportedAt: '2026-03-01T00:00:00.000Z' };
    for (const r of headerless) yield r;
  }
  const { recordCounts } = await serializeBackup(onlyHeader());
  assert.deepEqual(recordCounts, {});
});
