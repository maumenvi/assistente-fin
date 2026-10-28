import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExportBackupUseCase } from '../../../src/app/backup/export.backup.use.case.ts';
import { ImportBackupUseCase } from '../../../src/app/backup/import.backup.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { InvalidBackupError } from '../../../src/domain/backup/invalid.backup.error.ts';
import { type BackupRecord } from '../../../src/app/shared/backup.record.schema.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { FixedExpense } from '../../../src/domain/fixed-expense/fixed.expense.entity.ts';
import { SpendingLimit } from '../../../src/domain/spending-limit/spending.limit.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { TransactionSeries } from '../../../src/domain/transaction/transaction.series.entity.ts';
import { PurchaseSimulation } from '../../../src/domain/simulation/simulation.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

/** `AsyncGenerator` que reproduz uma lista ja coletada - generators sao consumiveis uma vez so. */
async function* fromArray<T>(items: readonly T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

const verifiedUser = (): User =>
  User.create({
    id: 'u1',
    cpf: Cpf.create('52998224725'),
    email: Email.create('marco@exemplo.com'),
    phone: Phone.create('11987654321'),
    name: 'Marco',
    createdAt: NOW,
  })
    .verifyEmail(NOW)
    .verifyPhone(NOW);

/** Monta uma base fonte com um exemplar de cada entidade e devolve os records exportados. */
const buildFullBackup = async (): Promise<BackupRecord[]> => {
  const source = new FakeDatabase();
  await source.users.save(verifiedUser());
  for (const [id, name] of Object.entries({
    'cat-trabalho': 'Trabalho',
    'cat-aluguel': 'Aluguel',
    'cat-mercado': 'Mercado',
    'cat-eletronicos': 'Eletronicos',
  })) {
    await source.categories.save(
      Category.create({ id, userId: 'u1', name: CategoryName.create(name) }),
    );
  }
  await source.accounts.save(
    Account.create({ id: 'acc1', userId: 'u1', name: 'Carteira', kind: 'checking', openingBalance: Money.zero() }),
  );
  await source.incomes.save(
    Income.create({
      id: 'i1',
      userId: 'u1',
      date: NOW,
      amount: Money.fromCents(500_000),
      source: 'Salario',
      recurrence: Recurrence.none(),
      categoryId: 'cat-trabalho',
      accountId: 'acc1',
    }),
  );
  await source.fixedExpenses.save(
    FixedExpense.create({
      id: 'fe1',
      userId: 'u1',
      dueDay: 10,
      expectedAmount: Money.fromCents(20_000),
      categoryId: 'cat-aluguel',
      accountId: 'acc1',
    }),
  );
  await source.spendingLimits.save(
    SpendingLimit.create({
      id: 'sl1',
      userId: 'u1',
      categoryId: 'cat-mercado',
      period: Month.create({ year: 2026, month: 1 }),
      maxAmount: Money.fromCents(30_000),
    }),
  );
  await source.transactionSeries.save(
    TransactionSeries.create({
      id: 'series-1',
      userId: 'u1',
      accountId: 'acc1',
      type: 'expense',
      amount: Money.fromCents(5_000),
      categoryId: 'cat-mercado',
      recurrence: Recurrence.create({
        frequency: 'mensal',
        endDate: new Date('2026-06-01T00:00:00.000Z'),
      }),
      anchorDate: NOW,
    }),
  );
  await source.transactions.save(
    Transaction.create({
      id: 't1',
      userId: 'u1',
      date: NOW,
      amount: Money.fromCents(5_000),
      type: 'expense',
      categoryId: 'cat-mercado',
      accountId: 'acc1',
      seriesId: 'series-1',
    }),
  );
  await source.transactions.save(
    Transaction.create({
      id: 't2-income',
      userId: 'u1',
      date: NOW,
      amount: Money.fromCents(500_000),
      type: 'income',
      categoryId: 'cat-trabalho',
      accountId: 'acc1',
      incomeId: 'i1',
    }),
  );
  await source.simulations.save(
    PurchaseSimulation.create({
      id: 'sim1',
      userId: 'u1',
      amount: Money.fromCents(30_000),
      date: NOW,
      categoryId: 'cat-eletronicos',
      payment: 'credit-card',
      installments: 1,
      recurrence: Recurrence.none(),
      accountId: 'acc1',
    }),
  );

  const exportUseCase = new ExportBackupUseCase(source, new FixedClock(NOW));
  const records: BackupRecord[] = [];
  for await (const record of await exportUseCase.execute({ userId: 'u1' })) {
    records.push(record);
  }
  return records;
};

/** Base de destino com o usuario ja existente (import nao cria usuario, so restaura os dados dele). */
const makeTargetDatabase = async (options: { verified?: boolean } = {}): Promise<FakeDatabase> => {
  const { verified = true } = options;
  const database = new FakeDatabase();
  let user = verifiedUser();
  if (!verified) {
    user = User.create({
      id: 'u1',
      cpf: Cpf.create('52998224725'),
      email: Email.create('marco@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Marco',
      createdAt: NOW,
    });
  }
  await database.users.save(user);
  return database;
};

test('roundtrip export->import: restaura tudo no destino, com o mesmo conteudo (RF-17, RF-18)', async () => {
  const records = await buildFullBackup();
  const target = await makeTargetDatabase();
  const importUseCase = new ImportBackupUseCase(target);

  const report = await importUseCase.execute({ userId: 'u1', records: fromArray(records) });

  assert.deepEqual(report, {
    categories: 4,
    accounts: 1,
    incomes: 1,
    fixedExpenses: 1,
    spendingLimits: 1,
    spendingLimitPlans: 0,
    transactionSeries: 1,
    transactions: 2,
    purchaseSimulations: 1,
    preRegistrations: 0,
    captureAttachments: 0,
    preferences: 0,
    rules: 0,
  });

  const restoredSeries = await target.transactionSeries.findById('u1', 'series-1');
  assert.equal(restoredSeries?.recurrence.frequency, 'mensal');
  assert.equal(restoredSeries?.anchorDate.toISOString(), NOW.toISOString());
  assert.equal((await target.transactions.findById('u1', 't1'))?.seriesId, 'series-1');

  const account = await target.accounts.findById('u1', 'acc1');
  assert.equal(account?.name, 'Carteira');
  const income = await target.incomes.findById('u1', 'i1');
  assert.equal(income?.amount.cents, 500_000);
  assert.equal(income?.accountId, 'acc1', 'spec 012, RF-1: accountId preservado no round-trip');
  assert.equal((await target.fixedExpenses.listByUser('u1'))[0]?.dueDay, 10);
  assert.equal((await target.spendingLimits.listByUser('u1'))[0]?.maxAmount.cents, 30_000);
  assert.equal((await target.transactions.findById('u1', 't1'))?.categoryId, 'cat-mercado');
  assert.equal(
    (await target.transactions.findById('u1', 't2-income'))?.incomeId,
    'i1',
    'spec 012, Q2: incomeId preservado no round-trip',
  );
  assert.equal((await target.simulations.listByUser('u1'))[0]?.amount.cents, 30_000);
});

test('reimportar o mesmo backup e idempotente - nao duplica (CA-16)', async () => {
  const records = await buildFullBackup();
  const target = await makeTargetDatabase();
  const importUseCase = new ImportBackupUseCase(target);

  await importUseCase.execute({ userId: 'u1', records: fromArray(records) });
  await importUseCase.execute({ userId: 'u1', records: fromArray(records) });

  assert.equal((await target.accounts.listByUser('u1')).length, 1);
  assert.equal((await target.incomes.listByUser('u1')).length, 1);
  assert.equal((await target.transactions.listByUser('u1')).length, 2);
});

test('record com forma invalida vira InvalidBackupError (CA-17)', async () => {
  const target = await makeTargetDatabase();
  const importUseCase = new ImportBackupUseCase(target);

  const bogus = [
    { kind: 'header', schemaVersion: 2, userId: 'u1', exportedAt: NOW.toISOString() },
    { kind: 'account', id: 'acc1' /* faltam campos obrigatorios */ },
  ];

  await assert.rejects(
    importUseCase.execute({ userId: 'u1', records: fromArray(bogus) }),
    InvalidBackupError,
  );
});

test('schemaVersion incompativel vira InvalidBackupError', async () => {
  const target = await makeTargetDatabase();
  const importUseCase = new ImportBackupUseCase(target);

  const records = [{ kind: 'header', schemaVersion: 999, userId: 'u1', exportedAt: NOW.toISOString() }];

  await assert.rejects(
    importUseCase.execute({ userId: 'u1', records: fromArray(records) }),
    InvalidBackupError,
  );
});

test('header duplicado vira InvalidBackupError', async () => {
  const target = await makeTargetDatabase();
  const importUseCase = new ImportBackupUseCase(target);

  const header = { kind: 'header', schemaVersion: 2, userId: 'u1', exportedAt: NOW.toISOString() };

  await assert.rejects(
    importUseCase.execute({ userId: 'u1', records: fromArray([header, header]) }),
    InvalidBackupError,
  );
});

test('header ausente vira InvalidBackupError', async () => {
  const target = await makeTargetDatabase();
  const importUseCase = new ImportBackupUseCase(target);

  const account = {
    kind: 'account',
    id: 'acc1',
    userId: 'u1',
    name: 'Carteira',
    accountKind: 'checking',
    openingBalanceCents: 0,
    currency: 'BRL',
    archived: false,
  };

  await assert.rejects(
    importUseCase.execute({ userId: 'u1', records: fromArray([account]) }),
    InvalidBackupError,
  );
});

test('record de outro usuario vira InvalidBackupError (RF-16)', async () => {
  const target = await makeTargetDatabase();
  const importUseCase = new ImportBackupUseCase(target);

  const records = [{ kind: 'header', schemaVersion: 2, userId: 'outro-usuario', exportedAt: NOW.toISOString() }];

  await assert.rejects(
    importUseCase.execute({ userId: 'u1', records: fromArray(records) }),
    InvalidBackupError,
  );
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const target = await makeTargetDatabase();
  const importUseCase = new ImportBackupUseCase(target);

  await assert.rejects(
    importUseCase.execute({ userId: 'inexistente', records: fromArray([]) }),
    UserNotFoundError,
  );
});

test('usuario nao verificado vira UserNotVerifiedError (RF-28)', async () => {
  const target = await makeTargetDatabase({ verified: false });
  const importUseCase = new ImportBackupUseCase(target);

  await assert.rejects(
    importUseCase.execute({ userId: 'u1', records: fromArray([]) }),
    UserNotVerifiedError,
  );
});

test('entrada invalida (records nao e AsyncIterable) vira InvalidInputError (CA-11)', async () => {
  const target = await makeTargetDatabase();
  const importUseCase = new ImportBackupUseCase(target);

  await assert.rejects(
    importUseCase.execute({ userId: 'u1', records: 'nao-e-um-stream' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'importar backup');
      return true;
    },
  );
});

test('adoptForeignBackup: backup de outro aparelho passa a ser do usuario da sessao (spec 022, FR-007)', async () => {
  const records = (await buildFullBackup()).map((record) => ({ ...record, userId: 'usuario-do-celular' }));
  const target = new FakeDatabase();
  const phoneOwner = User.create({
    id: 'u-desktop',
    cpf: Cpf.create('11144477735'),
    email: Email.create('outro@exemplo.com'),
    phone: Phone.create('11912345678'),
    name: 'Dono do desktop',
    createdAt: NOW,
  })
    .verifyEmail(NOW)
    .verifyPhone(NOW);
  await target.users.save(phoneOwner);

  await new ImportBackupUseCase(target).execute({
    userId: 'u-desktop',
    records: fromArray(records),
    adoptForeignBackup: true,
  });

  assert.equal((await target.accounts.listByUser('u-desktop')).length, 1);
  assert.equal((await target.accounts.listByUser('usuario-do-celular')).length, 0);
});

test('adoptForeignBackup nunca adota um usuario que existe neste banco (RF-16)', async () => {
  const target = await makeTargetDatabase();
  const other = User.create({
    id: 'u2',
    cpf: Cpf.create('11144477735'),
    email: Email.create('outro@exemplo.com'),
    phone: Phone.create('11912345678'),
    name: 'Outro',
    createdAt: NOW,
  });
  await target.users.save(other);
  const records = [{ kind: 'header', schemaVersion: 2, userId: 'u2', exportedAt: NOW.toISOString() }];

  await assert.rejects(
    new ImportBackupUseCase(target).execute({ userId: 'u1', records: fromArray(records), adoptForeignBackup: true }),
    InvalidBackupError,
  );
});
