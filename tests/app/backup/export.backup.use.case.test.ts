import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExportBackupUseCase } from '../../../src/app/backup/export.backup.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
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

const collect = async (generator: AsyncGenerator<BackupRecord>): Promise<BackupRecord[]> => {
  const records: BackupRecord[] = [];
  for await (const record of generator) {
    records.push(record);
  }
  return records;
};

const makeUseCase = async (options: { withData?: boolean } = {}) => {
  const { withData = true } = options;
  const database = new FakeDatabase();

  const user = User.create({
    id: 'u1',
    cpf: Cpf.create('52998224725'),
    email: Email.create('marco@exemplo.com'),
    phone: Phone.create('11987654321'),
    name: 'Marco',
    createdAt: NOW,
  });
  await database.users.save(user);

  // todo usuario real tem ao menos a categoria padrao (spec 003, RF-8)
  await database.categories.save(
    Category.create({ id: 'cat-default', userId: 'u1', name: CategoryName.create('SEM CATEGORIA'), isDefault: true }),
  );

  if (withData) {
    for (const [id, name] of Object.entries({
      'cat-trabalho': 'Trabalho',
      'cat-aluguel': 'Aluguel',
      'cat-mercado': 'Mercado',
      'cat-eletronicos': 'Eletronicos',
    })) {
      await database.categories.save(
        Category.create({ id, userId: 'u1', name: CategoryName.create(name) }),
      );
    }
    await database.accounts.save(
      Account.create({
        id: 'acc1',
        userId: 'u1',
        name: 'Carteira',
        kind: 'checking',
        openingBalance: Money.zero(),
      }),
    );
    await database.incomes.save(
      Income.create({
        id: 'i1',
        userId: 'u1',
        date: NOW,
        amount: Money.fromCents(500_000),
        source: 'Salario',
        recurrence: Recurrence.none(),
        categoryId: 'cat-trabalho',
      }),
    );
    await database.fixedExpenses.save(
      FixedExpense.create({
        id: 'fe1',
        userId: 'u1',
        dueDay: 10,
        expectedAmount: Money.fromCents(20_000),
        categoryId: 'cat-aluguel',
        accountId: 'acc1',
      }),
    );
    await database.spendingLimits.save(
      SpendingLimit.create({
        id: 'sl1',
        userId: 'u1',
        categoryId: 'cat-mercado',
        period: Month.create({ year: 2026, month: 1 }),
        maxAmount: Money.fromCents(30_000),
      }),
    );
    await database.transactionSeries.save(
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
    await database.transactions.save(
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
    await database.simulations.save(
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
  }

  const useCase = new ExportBackupUseCase(database, new FixedClock(new Date('2026-02-01T00:00:00.000Z')));
  return { database, useCase };
};

test('gera header seguido de um record por entidade, na ordem categories->accounts->incomes->fixedExpenses->spendingLimits->transactionSeries->transactions->purchaseSimulations (RF-17, CA-15)', async () => {
  const { useCase } = await makeUseCase();

  const records = await collect(await useCase.execute({ userId: 'u1' }));

  assert.deepEqual(
    records.map((r) => r.kind),
    [
      'header',
      'category',
      'category',
      'category',
      'category',
      'category',
      'account',
      'income',
      'fixedExpense',
      'spendingLimit',
      'transactionSeries',
      'transaction',
      'purchaseSimulation',
    ],
  );
  const header = records[0]!;
  if (header.kind !== 'header') throw new Error('esperava header');
  assert.equal(header.schemaVersion, 5); // v5: regras de categorizacao (spec 033); v4: preferencias (spec 032)
  assert.equal(header.userId, 'u1');
  assert.equal(header.exportedAt, '2026-02-01T00:00:00.000Z');
});

test('sem dados, so o header (usuario recem-criado)', async () => {
  const { useCase } = await makeUseCase({ withData: false });

  const records = await collect(await useCase.execute({ userId: 'u1' }));

  // so o header + a categoria padrao (que todo usuario tem)
  assert.deepEqual(
    records.map((r) => r.kind),
    ['header', 'category'],
  );
});

test('usuario inexistente vira UserNotFoundError, antes de comecar o stream', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ userId: 'inexistente' }), UserNotFoundError);
});

test('entrada invalida vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ userId: '' }), (error: unknown) => {
    assert.ok(error instanceof InvalidInputError);
    assert.equal(error.context, 'exportar backup');
    return true;
  });
});
