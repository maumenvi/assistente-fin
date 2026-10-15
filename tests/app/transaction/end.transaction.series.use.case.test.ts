import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EndTransactionSeriesUseCase } from '../../../src/app/transaction/end.transaction.series.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { TransactionSeriesNotFoundError } from '../../../src/domain/transaction/transaction.series.not.found.error.ts';
import { TransactionNotFoundError } from '../../../src/domain/transaction/transaction.not.found.error.ts';
import { TransactionSeries } from '../../../src/domain/transaction/transaction.series.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { addUtcMonths } from '../../../src/domain/shared/add.utc.months.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const ANCHOR = new Date('2026-01-05T00:00:00.000Z');
// "hoje" no meio da serie: fev/mar sao passado, abr em diante e futuro
const TODAY = new Date('2026-03-20T00:00:00.000Z');

const occurrence = (id: string, monthsFromAnchor: number, seriesId: string | null = 'series-1') =>
  Transaction.create({
    id,
    userId: 'u1',
    date: addUtcMonths(ANCHOR, monthsFromAnchor),
    amount: Money.fromCents(20_000),
    type: 'expense',
    categoryId: 'cat-1',
    accountId: 'acc1',
    seriesId,
  });

const setup = async () => {
  const database = new FakeDatabase();
  const useCase = new EndTransactionSeriesUseCase(database, new FixedClock(TODAY));

  // serie mensal jan..set (final = ancora + 8m)
  await database.transactionSeries.save(
    TransactionSeries.create({
      id: 'series-1',
      userId: 'u1',
      accountId: 'acc1',
      type: 'expense',
      amount: Money.fromCents(20_000),
      categoryId: 'cat-1',
      recurrence: Recurrence.create({ frequency: 'mensal', endDate: addUtcMonths(ANCHOR, 8) }),
      anchorDate: ANCHOR,
    }),
  );
  // occ-0 jan .. occ-8 set
  for (let i = 0; i <= 8; i += 1) {
    await database.transactions.save(occurrence(`occ-${i}`, i));
  }
  return { database, useCase };
};

test('remove as ocorrencias futuras a partir do pivo, mantem as passadas (CA-21)', async () => {
  const { database, useCase } = await setup();

  // encerrar a partir de abril (occ-3): abril fica, maio..set somem
  const result = await useCase.execute({
    userId: 'u1',
    seriesId: 'series-1',
    fromTransactionId: 'occ-3',
  });

  assert.equal(result.removedOccurrenceCount, 5); // occ-4..occ-8
  const ids = (await database.transactions.listByUser('u1')).map((t) => t.id).sort();
  assert.deepEqual(ids, ['occ-0', 'occ-1', 'occ-2', 'occ-3']);

  // a data final do molde veio para a data do pivo
  const series = await database.transactionSeries.findById('u1', 'series-1');
  assert.equal(series?.recurrence.endDate?.toISOString(), addUtcMonths(ANCHOR, 3).toISOString());
});

test('nao remove ocorrencias no passado, mesmo depois do pivo', async () => {
  const { database, useCase } = await setup();

  // pivo = janeiro (occ-0); fev/mar sao "date > pivo" mas ja passaram (date < hoje) -> ficam
  const result = await useCase.execute({
    userId: 'u1',
    seriesId: 'series-1',
    fromTransactionId: 'occ-0',
  });

  assert.equal(result.removedOccurrenceCount, 6); // occ-3..occ-8 (abr..set, futuras)
  const ids = (await database.transactions.listByUser('u1')).map((t) => t.id).sort();
  assert.deepEqual(ids, ['occ-0', 'occ-1', 'occ-2']);
});

test('nao toca ocorrencias ja desanexadas (seriesId = null) (CA-21)', async () => {
  const { database, useCase } = await setup();
  // occ-5 foi editada e desanexada
  await database.transactions.save(
    (await database.transactions.findById('u1', 'occ-5'))!.withUpdatedAt(null),
  );
  const detached = Transaction.fromPersistence({
    id: 'occ-5',
    userId: 'u1',
    date: addUtcMonths(ANCHOR, 5),
    amount: Money.fromCents(99_999),
    type: 'expense',
    categoryId: 'cat-1',
    accountId: 'acc1',
    seriesId: null,
  });
  await database.transactions.save(detached);

  const result = await useCase.execute({
    userId: 'u1',
    seriesId: 'series-1',
    fromTransactionId: 'occ-3',
  });

  // occ-4, occ-6, occ-7, occ-8 somem; occ-5 (desanexada) fica
  assert.equal(result.removedOccurrenceCount, 4);
  assert.ok(await database.transactions.findById('u1', 'occ-5'), 'a desanexada continua');
});

test('serie inexistente ou de outro usuario -> TransactionSeriesNotFoundError', async () => {
  const { useCase } = await setup();

  await assert.rejects(
    useCase.execute({ userId: 'u1', seriesId: 'sumiu', fromTransactionId: 'occ-3' }),
    TransactionSeriesNotFoundError,
  );
  await assert.rejects(
    useCase.execute({ userId: 'u2', seriesId: 'series-1', fromTransactionId: 'occ-3' }),
    TransactionSeriesNotFoundError,
  );
});

test('pivo inexistente ou de outra serie -> TransactionNotFoundError', async () => {
  const { database, useCase } = await setup();
  await database.transactions.save(occurrence('avulso', 4, null));

  await assert.rejects(
    useCase.execute({ userId: 'u1', seriesId: 'series-1', fromTransactionId: 'sumiu' }),
    TransactionNotFoundError,
  );
  await assert.rejects(
    useCase.execute({ userId: 'u1', seriesId: 'series-1', fromTransactionId: 'avulso' }),
    TransactionNotFoundError,
  );
});

test('entrada invalida -> InvalidInputError', async () => {
  const { useCase } = await setup();

  await assert.rejects(
    useCase.execute({ userId: '', seriesId: '', fromTransactionId: '' }),
    InvalidInputError,
  );
});
