import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toTransactionRecord,
  fromTransactionRecord,
  toIncomeRecord,
  fromIncomeRecord,
  toPreRegistrationRecord,
  fromPreRegistrationRecord,
} from '../../../src/app/backup/backup.record.mapper.ts';
import { backupRecordSchema } from '../../../src/app/shared/backup.record.schema.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';

const base = () => ({
  id: 'tx-1',
  userId: 'u1',
  date: new Date('2026-03-01T00:00:00.000Z'),
  amount: Money.fromCents(20_000),
  type: 'expense' as const,
  categoryId: 'cat-mercado',
  accountId: 'acc-1',
});

test('transacao avulsa: o record nao carrega recorrencia nem seriesId (spec 003, RF-16)', () => {
  const record = toTransactionRecord(Transaction.create(base()));

  assert.equal(record.recurrenceFrequency, undefined);
  assert.equal(record.recurrenceEveryN, undefined);
  assert.equal(record.recurrenceEndDate, undefined);
  assert.equal(record.seriesId, undefined);
  assert.equal(record.categoryId, 'cat-mercado');
  assert.ok(backupRecordSchema.safeParse(record).success, 'record valido no schema v2');

  const back = fromTransactionRecord(record);
  assert.equal(back.recurrence.frequency, 'nao-repete');
  assert.equal(back.seriesId, null);
});

test('transacao recorrente faz round-trip com frequencia, everyN, endDate e seriesId', () => {
  const transaction = Transaction.create({
    ...base(),
    recurrence: Recurrence.create({
      frequency: 'semanal',
      everyN: 2,
      endDate: new Date('2026-06-01T00:00:00.000Z'),
    }),
    seriesId: 'serie-7',
  });

  const record = toTransactionRecord(transaction);
  assert.ok(backupRecordSchema.safeParse(record).success, 'record valido no schema v2');
  assert.equal(record.recurrenceFrequency, 'semanal');
  assert.equal(record.recurrenceEveryN, 2);
  assert.equal(record.recurrenceEndDate, '2026-06-01T00:00:00.000Z');
  assert.equal(record.seriesId, 'serie-7');

  const back = fromTransactionRecord(record);
  assert.ok(back.recurrence.equals(transaction.recurrence));
  assert.equal(back.seriesId, 'serie-7');
  assert.equal(back.amount.cents, 20_000);
  assert.equal(back.date.getTime(), transaction.date.getTime());
});

test('transacao com incomeId faz round-trip (spec 012, Q2)', () => {
  const transaction = Transaction.create({ ...base(), type: 'income', incomeId: 'income-1' });

  const record = toTransactionRecord(transaction);
  assert.ok(backupRecordSchema.safeParse(record).success, 'record valido no schema v2');
  assert.equal(record.incomeId, 'income-1');

  const back = fromTransactionRecord(record);
  assert.equal(back.incomeId, 'income-1');
});

test('transacao sem incomeId: o record nao carrega o campo, round-trip preserva null', () => {
  const transaction = Transaction.create(base());

  const record = toTransactionRecord(transaction);
  assert.equal(record.incomeId, undefined);

  const back = fromTransactionRecord(record);
  assert.equal(back.incomeId, null);
});

test('income com accountId faz round-trip (spec 012, RF-1)', () => {
  const income = Income.create({
    id: 'income-1',
    userId: 'u1',
    date: new Date('2026-01-05T00:00:00.000Z'),
    amount: Money.fromCents(500_000),
    source: 'Salario',
    recurrence: Recurrence.none(),
    categoryId: 'cat-trabalho',
    accountId: 'acc-1',
  });

  const record = toIncomeRecord(income);
  assert.ok(backupRecordSchema.safeParse(record).success, 'record valido no schema v2');
  assert.equal(record.accountId, 'acc-1');

  const back = fromIncomeRecord(record);
  assert.equal(back.accountId, 'acc-1');
});

test('income sem accountId: o record nao carrega o campo, round-trip preserva null', () => {
  const income = Income.create({
    id: 'income-1',
    userId: 'u1',
    date: new Date('2026-01-05T00:00:00.000Z'),
    amount: Money.fromCents(500_000),
    source: 'Salario',
    recurrence: Recurrence.none(),
    categoryId: 'cat-trabalho',
  });

  const record = toIncomeRecord(income);
  assert.equal(record.accountId, undefined);

  const back = fromIncomeRecord(record);
  assert.equal(back.accountId, null);
});

test('pre-registro: duplicateReviewed vai no backup so quando verdadeiro e volta falso se ausente (spec 028)', () => {
  const pre = PreRegistration.create({ id: 'p1', userId: 'u1', origin: 'wallet', createdAt: new Date('2026-10-01T00:00:00.000Z'), duplicateReviewed: true });
  const record = toPreRegistrationRecord(pre);
  assert.equal(record.duplicateReviewed, true);
  assert.equal(fromPreRegistrationRecord(record).duplicateReviewed, true);

  const plain = toPreRegistrationRecord(PreRegistration.create({ id: 'p2', userId: 'u1', origin: 'wallet', createdAt: new Date('2026-10-01T00:00:00.000Z') }));
  assert.equal(plain.duplicateReviewed, undefined);
  assert.equal(fromPreRegistrationRecord(plain).duplicateReviewed, false);
});
