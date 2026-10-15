import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { InvalidIncomeError } from '../../../src/domain/income/invalid.income.error.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { monthlyFrom } from '../../support/recurrence.ts';

const base = () => ({
  id: 'income-1',
  userId: 'user-1',
  date: new Date('2026-01-05T00:00:00.000Z'),
  amount: Money.fromCents(500_000),
  source: '  Salario  ',
  recurrence: monthlyFrom('2026-01-05T00:00:00.000Z'),
  categoryId: '  Trabalho  ',
  notes: '  observacao  ',
});

test('create normaliza textos e preserva os demais campos (RF-2)', () => {
  const income = Income.create(base());

  assert.equal(income.source, 'Salario');
  assert.equal(income.categoryId, 'Trabalho');
  assert.equal(income.notes, 'observacao');
  assert.equal(income.amount.cents, 500_000);
  assert.equal(income.recurrence.frequency, 'mensal');
});

test('notes e opcional', () => {
  const { notes: _notes, ...rest } = base();
  const income = Income.create(rest);
  assert.equal(income.notes, undefined);
});

test('create rejeita campos invalidos', () => {
  assert.throws(() => Income.create({ ...base(), id: '' }), InvalidIncomeError);
  assert.throws(() => Income.create({ ...base(), userId: '' }), InvalidIncomeError);
  assert.throws(() => Income.create({ ...base(), date: new Date('invalido') }), InvalidIncomeError);
  assert.throws(
    // @ts-expect-error amount invalido de proposito
    () => Income.create({ ...base(), amount: 500 }),
    InvalidIncomeError,
  );
  assert.throws(() => Income.create({ ...base(), amount: Money.zero() }), InvalidIncomeError);
  assert.throws(
    () => Income.create({ ...base(), amount: Money.fromCents(-100) }),
    InvalidIncomeError,
  );
  assert.throws(() => Income.create({ ...base(), source: '   ' }), InvalidIncomeError);
  assert.throws(
    // @ts-expect-error recurrence invalido de proposito
    () => Income.create({ ...base(), recurrence: 'monthly' }),
    InvalidIncomeError,
  );
  assert.throws(() => Income.create({ ...base(), categoryId: '   ' }), InvalidIncomeError);
});

test('fromPersistence reaplica as mesmas invariantes de create (defesa em profundidade)', () => {
  const income = Income.fromPersistence(base());
  assert.equal(income.source, 'Salario');

  assert.throws(() => Income.fromPersistence({ ...base(), id: '' }), InvalidIncomeError);
});

test('accountId e opcional e default para null (spec 012, RF-1)', () => {
  const income = Income.create(base());
  assert.equal(income.accountId, null);
});

test('accountId aceita null explicito', () => {
  const income = Income.create({ ...base(), accountId: null });
  assert.equal(income.accountId, null);
});

test('accountId aceita string valida e e normalizado (trim)', () => {
  const income = Income.create({
    ...base(),
    accountId: '  account-1  ',
  });
  assert.equal(income.accountId, 'account-1');
});

test('accountId em branco e recusado (spec 012)', () => {
  assert.throws(() => Income.create({ ...base(), accountId: '   ' }), InvalidIncomeError);
});

test('withUpdatedAt preserva accountId', () => {
  const income = Income.create({ ...base(), accountId: 'account-1' });
  const stamped = income.withUpdatedAt(new Date('2026-09-10T00:00:00.000Z'));
  assert.equal(stamped.accountId, 'account-1');
});
