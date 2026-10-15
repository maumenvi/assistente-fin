import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExtendTransactionSeriesUseCase } from '../../../src/app/transaction/extend.transaction.series.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { TransactionSeriesNotFoundError } from '../../../src/domain/transaction/transaction.series.not.found.error.ts';
import { TransactionSeries } from '../../../src/domain/transaction/transaction.series.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { addUtcMonths } from '../../../src/domain/shared/add.utc.months.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const ANCHOR = new Date('2026-03-01T00:00:00.000Z');

const setup = async () => {
  const database = new FakeDatabase();
  const useCase = new ExtendTransactionSeriesUseCase(database, new SequentialIdGenerator('gen'));

  // serie mensal, final = ancora + 6m
  const series = TransactionSeries.create({
    id: 'series-1',
    userId: 'u1',
    accountId: 'acc1',
    type: 'expense',
    amount: Money.fromCents(20_000),
    categoryId: 'cat-1',
    recurrence: Recurrence.create({ frequency: 'mensal', endDate: addUtcMonths(ANCHOR, 6) }),
    anchorDate: ANCHOR,
  });
  await database.transactionSeries.save(series);
  // materializa as 7 ocorrencias iniciais (marco..setembro)
  for (let i = 0; i <= 6; i += 1) {
    await database.transactions.save(
      buildOccurrence(`occ-${i}`, addUtcMonths(ANCHOR, i)),
    );
  }
  return { database, useCase };
};

const buildOccurrence = (id: string, date: Date) =>
  Transaction.create({
    id,
    userId: 'u1',
    date,
    amount: Money.fromCents(20_000),
    type: 'expense',
    categoryId: 'cat-1',
    accountId: 'acc1',
    seriesId: 'series-1',
  });

test('nova data final = final atual + 1 alcance (mensal = +12m) (CA-25b)', async () => {
  const { database, useCase } = await setup();

  const result = await useCase.execute({ userId: 'u1', seriesId: 'series-1' });

  assert.equal(
    result.series.recurrence.endDate?.toISOString(),
    addUtcMonths(ANCHOR, 18).toISOString(), // 6m inicial + 12m
  );
  const stored = await database.transactionSeries.findById('u1', 'series-1');
  assert.equal(stored?.recurrence.endDate?.toISOString(), addUtcMonths(ANCHOR, 18).toISOString());
});

test('gera so as ocorrencias que passaram a caber (CA-18)', async () => {
  const { database, useCase } = await setup();

  const result = await useCase.execute({ userId: 'u1', seriesId: 'series-1' });

  // ja existiam 7 (meses 0..6); agora final = mes 18 -> meses 7..18 = 12 novas
  assert.equal(result.createdOccurrenceCount, 12);
  const all = await database.transactions.listByUser('u1');
  assert.equal(all.length, 19);
  assert.ok(all.every((t) => t.seriesId === 'series-1'));
});

test('prolongar de novo empurra mais um alcance, sem duplicar as ocorrencias existentes', async () => {
  const { database, useCase } = await setup();

  await useCase.execute({ userId: 'u1', seriesId: 'series-1' });
  const second = await useCase.execute({ userId: 'u1', seriesId: 'series-1' });

  assert.equal(
    second.series.recurrence.endDate?.toISOString(),
    addUtcMonths(ANCHOR, 30).toISOString(), // 6 + 12 + 12
  );
  assert.equal(second.createdOccurrenceCount, 12); // meses 19..30
  assert.equal((await database.transactions.listByUser('u1')).length, 31);
});

test('serie inexistente ou de outro usuario -> TransactionSeriesNotFoundError', async () => {
  const { useCase } = await setup();

  await assert.rejects(
    useCase.execute({ userId: 'u1', seriesId: 'inexistente' }),
    TransactionSeriesNotFoundError,
  );
  await assert.rejects(
    useCase.execute({ userId: 'u2', seriesId: 'series-1' }),
    TransactionSeriesNotFoundError,
  );
});

test('entrada invalida -> InvalidInputError', async () => {
  const { useCase } = await setup();

  await assert.rejects(useCase.execute({ userId: '', seriesId: '' }), InvalidInputError);
  await assert.rejects(useCase.execute({}), InvalidInputError);
});

test('serie espelho de Income: ocorrencias novas herdam o mesmo incomeId (spec 012, RF-5)', async () => {
  const database = new FakeDatabase();
  const useCase = new ExtendTransactionSeriesUseCase(database, new SequentialIdGenerator('gen'));

  const series = TransactionSeries.create({
    id: 'series-income',
    userId: 'u1',
    accountId: 'acc1',
    type: 'income',
    amount: Money.fromCents(500_000),
    categoryId: 'cat-salario',
    recurrence: Recurrence.create({ frequency: 'mensal', endDate: addUtcMonths(ANCHOR, 6) }),
    anchorDate: ANCHOR,
  });
  await database.transactionSeries.save(series);
  for (let i = 0; i <= 6; i += 1) {
    await database.transactions.save(
      Transaction.create({
        id: `occ-income-${i}`,
        userId: 'u1',
        date: addUtcMonths(ANCHOR, i),
        amount: Money.fromCents(500_000),
        type: 'income',
        categoryId: 'cat-salario',
        accountId: 'acc1',
        seriesId: 'series-income',
        incomeId: 'income-1',
      }),
    );
  }

  const result = await useCase.execute({ userId: 'u1', seriesId: 'series-income' });

  assert.equal(result.createdOccurrenceCount, 12);
  const created = (await database.transactions.listByUser('u1')).filter(
    (t) => t.seriesId === 'series-income' && !t.id.startsWith('occ-income-'),
  );
  assert.equal(created.length, 12);
  assert.ok(created.every((t) => t.incomeId === 'income-1'));
});

test('serie de despesa (sem Income): ocorrencias novas continuam com incomeId nulo', async () => {
  const { database, useCase } = await setup();

  await useCase.execute({ userId: 'u1', seriesId: 'series-1' });

  const all = await database.transactions.listByUser('u1');
  assert.ok(all.every((t) => t.incomeId === null));
});
