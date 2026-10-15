import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionSeries } from '../../../src/domain/transaction/transaction.series.entity.ts';
import { InvalidTransactionSeriesError } from '../../../src/domain/transaction/invalid.transaction.series.error.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { addUtcMonths } from '../../../src/domain/shared/add.utc.months.ts';

const ANCHOR = new Date('2026-03-01T00:00:00.000Z');

const monthly = () =>
  Recurrence.create({ frequency: 'mensal', endDate: addUtcMonths(ANCHOR, 6) });

const base = () => ({
  id: 'series-1',
  userId: 'u1',
  accountId: 'acc1',
  type: 'expense' as const,
  amount: Money.fromCents(20_000),
  categoryId: 'cat-mercado',
  recurrence: monthly(),
  anchorDate: ANCHOR,
});

test('create: guarda o molde e normaliza os ids', () => {
  const series = TransactionSeries.create({ ...base(), id: '  series-1  ', notes: '  aluguel  ' });

  assert.equal(series.id, 'series-1');
  assert.equal(series.type, 'expense');
  assert.equal(series.amount.cents, 20_000);
  assert.equal(series.categoryId, 'cat-mercado');
  assert.equal(series.notes, 'aluguel');
  assert.equal(series.recurrence.frequency, 'mensal');
  assert.equal(series.anchorDate.getTime(), ANCHOR.getTime());
  assert.equal(series.updatedAt, null);
});

test('create: notes vazio vira undefined', () => {
  assert.equal(TransactionSeries.create({ ...base(), notes: '   ' }).notes, undefined);
  assert.equal(TransactionSeries.create(base()).notes, undefined);
});

test('create: serie exige recorrencia - `nao-repete` e recusada (RF-25)', () => {
  assert.throws(
    () => TransactionSeries.create({ ...base(), recurrence: Recurrence.none() }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidTransactionSeriesError);
      assert.match(error.message, /recorrencia/);
      return true;
    },
  );
});

test('create: amount tem que ser positivo', () => {
  assert.throws(
    () => TransactionSeries.create({ ...base(), amount: Money.zero() }),
    InvalidTransactionSeriesError,
  );
  assert.throws(
    () => TransactionSeries.create({ ...base(), amount: Money.fromCents(-1) }),
    InvalidTransactionSeriesError,
  );
});

test('create: campos obrigatorios', () => {
  assert.throws(() => TransactionSeries.create({ ...base(), id: '  ' }), InvalidTransactionSeriesError);
  assert.throws(() => TransactionSeries.create({ ...base(), userId: '' }), InvalidTransactionSeriesError);
  assert.throws(
    () => TransactionSeries.create({ ...base(), accountId: '' }),
    InvalidTransactionSeriesError,
  );
  assert.throws(
    () => TransactionSeries.create({ ...base(), categoryId: '   ' }),
    InvalidTransactionSeriesError,
  );
});

test('create: type invalido e recusado', () => {
  assert.throws(
    () => TransactionSeries.create({ ...base(), type: 'transfer' as 'expense' }),
    InvalidTransactionSeriesError,
  );
});

test('create: data final alem do alcance da frequencia e recusada (RF-18)', () => {
  const tooFar = Recurrence.create({ frequency: 'mensal', endDate: addUtcMonths(ANCHOR, 13) });

  assert.throws(
    () => TransactionSeries.create({ ...base(), recurrence: tooFar }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidTransactionSeriesError);
      assert.match(error.message, /alcance/);
      return true;
    },
  );
  // exatamente no teto passa
  const atCap = Recurrence.create({ frequency: 'mensal', endDate: addUtcMonths(ANCHOR, 12) });
  assert.doesNotThrow(() => TransactionSeries.create({ ...base(), recurrence: atCap }));
});

test('create: anchorDate invalida e recusada', () => {
  assert.throws(
    () => TransactionSeries.create({ ...base(), anchorDate: new Date('nao-e-data') }),
    InvalidTransactionSeriesError,
  );
});

test('extend: empurra a data final em 1 alcance a partir da atual (CA-25b)', () => {
  // base(): mensal, final = ancora + 6m
  const series = TransactionSeries.create(base());
  const { series: extended, previousEndDate } = series.extend();

  assert.equal(previousEndDate.toISOString(), addUtcMonths(ANCHOR, 6).toISOString());
  // mensal -> 1 alcance = +12m, a partir do final atual (ancora + 6m + 12m)
  assert.equal(extended.recurrence.endDate?.toISOString(), addUtcMonths(ANCHOR, 18).toISOString());
  assert.equal(extended.id, series.id);
  // a serie original nao muda
  assert.equal(series.recurrence.endDate?.toISOString(), addUtcMonths(ANCHOR, 6).toISOString());
});

test('extend: pode ir alem do teto ancorado na data inicial - e o proposito de prolongar', () => {
  // sucessivos prolongamentos: cada um so cresce 1 alcance, nunca de forma ilimitada
  let series = TransactionSeries.create(base());
  for (let i = 0; i < 3; i += 1) {
    series = series.extend().series;
  }
  // 6m inicial + 3 x 12m
  assert.equal(series.recurrence.endDate?.toISOString(), addUtcMonths(ANCHOR, 42).toISOString());
});

test('endAt: encurta a data final para a data dada (RF-29)', () => {
  const series = TransactionSeries.create(base()); // mensal, final = ancora + 6m
  const ended = series.endAt(addUtcMonths(ANCHOR, 3));

  assert.equal(ended.recurrence.endDate?.toISOString(), addUtcMonths(ANCHOR, 3).toISOString());
  assert.equal(ended.id, series.id);
  assert.equal(series.recurrence.endDate?.toISOString(), addUtcMonths(ANCHOR, 6).toISOString());
});

test('endAt: aceita encerrar exatamente na ancora (serie de uma ocorrencia so)', () => {
  const ended = TransactionSeries.create(base()).endAt(ANCHOR);
  assert.equal(ended.recurrence.endDate?.toISOString(), ANCHOR.toISOString());
});

test('endAt: recusa data antes da ancora ou depois do teto atual', () => {
  const series = TransactionSeries.create(base());
  assert.throws(() => series.endAt(addUtcMonths(ANCHOR, -1)), InvalidTransactionSeriesError);
  // teto atual = ancora + 6m; ancora + 8m e "prolongar", nao "encerrar"
  assert.throws(() => series.endAt(addUtcMonths(ANCHOR, 8)), InvalidTransactionSeriesError);
});

test('withUpdatedAt: carimba e devolve nova instancia', () => {
  const series = TransactionSeries.create(base());
  const stamp = new Date('2026-09-10T12:00:00.000Z');
  const stamped = series.withUpdatedAt(stamp);

  assert.equal(stamped.updatedAt?.toISOString(), stamp.toISOString());
  assert.equal(series.updatedAt, null);
  assert.equal(stamped.withUpdatedAt(null).updatedAt, null);
});

test('fromPersistence: round-trip de todos os campos e revalida (defesa em profundidade)', () => {
  const stamp = new Date('2026-09-10T12:00:00.000Z');
  const series = TransactionSeries.fromPersistence({
    ...base(),
    notes: 'aluguel',
    updatedAt: stamp,
  });

  assert.equal(series.notes, 'aluguel');
  assert.equal(series.updatedAt?.toISOString(), stamp.toISOString());

  assert.throws(
    () => TransactionSeries.fromPersistence({ ...base(), amount: Money.zero() }),
    InvalidTransactionSeriesError,
  );
});

test('fromPersistence: aceita serie prolongada (endDate alem do teto ancorado na inicial)', () => {
  const extended = TransactionSeries.create(base()).extend().series;

  // reconstruir a partir do estado persistido nao pode recusa-la
  const reloaded = TransactionSeries.fromPersistence({
    id: extended.id,
    userId: extended.userId,
    accountId: extended.accountId,
    type: extended.type,
    amount: extended.amount,
    categoryId: extended.categoryId,
    recurrence: extended.recurrence,
    anchorDate: extended.anchorDate,
    updatedAt: new Date('2026-09-10T00:00:00.000Z'),
  });

  assert.equal(
    reloaded.recurrence.endDate?.toISOString(),
    extended.recurrence.endDate?.toISOString(),
  );
});
