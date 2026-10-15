import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materializeSeries } from '../../../src/app/transaction/materialize.series.ts';
import { TransactionSeries } from '../../../src/domain/transaction/transaction.series.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { addUtcMonths } from '../../../src/domain/shared/add.utc.months.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const ANCHOR = new Date('2026-03-01T00:00:00.000Z');

const monthlySeries = (endMonthsFromAnchor: number) =>
  TransactionSeries.create({
    id: 'series-1',
    userId: 'u1',
    accountId: 'acc1',
    type: 'expense',
    amount: Money.fromCents(20_000),
    categoryId: 'cat-mercado',
    recurrence: Recurrence.create({
      frequency: 'mensal',
      endDate: addUtcMonths(ANCHOR, endMonthsFromAnchor),
    }),
    anchorDate: ANCHOR,
  });

test('gera uma Transaction por data de ocorrencia, todas com o mesmo seriesId', async () => {
  const repo = new FakeTransactionRepository();
  const created = await materializeSeries(repo, new SequentialIdGenerator('occ'), monthlySeries(3));

  assert.equal(created.length, 4); // marco, abril, maio, junho
  assert.ok(created.every((t) => t.seriesId === 'series-1'));
  assert.ok(created.every((t) => t.amount.cents === 20_000 && t.categoryId === 'cat-mercado'));
  assert.deepEqual(
    created.map((t) => t.date.toISOString().slice(0, 10)),
    ['2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01'],
  );
  assert.equal((await repo.listByUser('u1')).length, 4);
});

test('e idempotente: reexecutar so gera as ocorrencias que faltam (apos "prolongar")', async () => {
  const repo = new FakeTransactionRepository();
  const ids = new SequentialIdGenerator('occ');

  const firstRun = await materializeSeries(repo, ids, monthlySeries(3));
  assert.equal(firstRun.length, 4);

  const secondRun = await materializeSeries(repo, ids, monthlySeries(6));
  assert.equal(secondRun.length, 3, 'so julho, agosto, setembro');
  assert.deepEqual(
    secondRun.map((t) => t.date.toISOString().slice(0, 10)),
    ['2026-07-01', '2026-08-01', '2026-09-01'],
  );
  assert.equal((await repo.listByUser('u1')).length, 7);
});

test('reexecutar sem mudanca nao gera nada', async () => {
  const repo = new FakeTransactionRepository();
  const ids = new SequentialIdGenerator('occ');
  const series = monthlySeries(2);

  await materializeSeries(repo, ids, series);
  const again = await materializeSeries(repo, ids, series);

  assert.deepEqual(again, []);
  assert.equal((await repo.listByUser('u1')).length, 3);
});

test('sem incomeId (parametro omitido) -> ocorrencias com incomeId null (spec 012, regressao)', async () => {
  const repo = new FakeTransactionRepository();
  const created = await materializeSeries(repo, new SequentialIdGenerator('occ'), monthlySeries(2));

  assert.ok(created.every((t) => t.incomeId === null));
});

test('com incomeId: TODAS as ocorrencias materializadas recebem o mesmo incomeId (spec 012, RF-5 estendido)', async () => {
  const repo = new FakeTransactionRepository();
  const created = await materializeSeries(
    repo,
    new SequentialIdGenerator('occ'),
    monthlySeries(3),
    'income-1',
  );

  assert.equal(created.length, 4);
  assert.ok(created.every((t) => t.incomeId === 'income-1'));
});

test('ignora ocorrencias de OUTRA serie no mesmo dia', async () => {
  const repo = new FakeTransactionRepository();
  await repo.save(
    Transaction.create({
      id: 'outra',
      userId: 'u1',
      date: ANCHOR,
      amount: Money.fromCents(999),
      type: 'expense',
      categoryId: 'cat-mercado',
      accountId: 'acc1',
      seriesId: 'serie-outra',
    }),
  );

  const created = await materializeSeries(repo, new SequentialIdGenerator('occ'), monthlySeries(2));

  // a ocorrencia da ancora e gerada mesmo assim - "outra" e de outra serie
  assert.equal(created.length, 3);
  assert.equal((await repo.listByUser('u1')).length, 4);
});
