import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixedExpense } from '../../../src/domain/fixed-expense/fixed.expense.entity.ts';
import { InvalidFixedExpenseError } from '../../../src/domain/fixed-expense/invalid.fixed.expense.error.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';

const base = () => ({
  id: 'fe-1',
  userId: 'user-1',
  dueDay: 10,
  expectedAmount: Money.fromCents(15_000),
  categoryId: '  Aluguel  ',
  accountId: 'acc-1',
});

test('create nasce nao pago e normaliza category (RF-3)', () => {
  const expense = FixedExpense.create(base());

  assert.equal(expense.paid, false);
  assert.equal(expense.categoryId, 'Aluguel');
  assert.equal(expense.dueDay, 10);
});

test('create rejeita campos invalidos', () => {
  assert.throws(() => FixedExpense.create({ ...base(), id: '' }), InvalidFixedExpenseError);
  assert.throws(() => FixedExpense.create({ ...base(), dueDay: 0 }), InvalidFixedExpenseError);
  assert.throws(() => FixedExpense.create({ ...base(), dueDay: 32 }), InvalidFixedExpenseError);
  assert.throws(() => FixedExpense.create({ ...base(), dueDay: 15.5 }), InvalidFixedExpenseError);
  assert.throws(
    () => FixedExpense.create({ ...base(), expectedAmount: Money.zero() }),
    InvalidFixedExpenseError,
  );
  assert.throws(
    () => FixedExpense.create({ ...base(), expectedAmount: Money.fromCents(-100) }),
    InvalidFixedExpenseError,
  );
  assert.throws(() => FixedExpense.create({ ...base(), categoryId: '  ' }), InvalidFixedExpenseError);
  assert.throws(() => FixedExpense.create({ ...base(), accountId: '' }), InvalidFixedExpenseError);
});

test('markAsPaid/markAsUnpaid sao imutaveis e idempotentes', () => {
  const expense = FixedExpense.create(base());

  const paid = expense.markAsPaid();
  assert.equal(paid.paid, true);
  assert.equal(expense.paid, false, 'nao muta o original');
  assert.equal(paid.markAsPaid(), paid, 'idempotente');

  const unpaid = paid.markAsUnpaid();
  assert.equal(unpaid.paid, false);
  assert.equal(unpaid.markAsUnpaid(), unpaid, 'idempotente');
});

test('fromPersistence reconstroi (com status de pagamento) reaplicando as invariantes', () => {
  const expense = FixedExpense.fromPersistence({ ...base(), paid: true });
  assert.equal(expense.paid, true);

  assert.throws(
    () => FixedExpense.fromPersistence({ ...base(), id: '', paid: false }),
    InvalidFixedExpenseError,
  );
});

test('referenceMonth valido (1-12) e aceito (spec 006, RF-1)', () => {
  const expense = FixedExpense.create({ ...base(), referenceMonth: 3 });
  assert.equal(expense.referenceMonth, 3);
});

test('referenceMonth fora de 1-12 lanca InvalidFixedExpenseError', () => {
  assert.throws(
    () => FixedExpense.create({ ...base(), referenceMonth: 0 }),
    InvalidFixedExpenseError,
  );
  assert.throws(
    () => FixedExpense.create({ ...base(), referenceMonth: 13 }),
    InvalidFixedExpenseError,
  );
  assert.throws(
    () => FixedExpense.create({ ...base(), referenceMonth: 1.5 }),
    InvalidFixedExpenseError,
  );
});

test('referenceMonth e description ausentes sao aceitos (ambos opcionais)', () => {
  const expense = FixedExpense.create(base());
  assert.equal(expense.referenceMonth, null);
  assert.equal(expense.description, null);
});

test('description com espacos nas bordas e trimada', () => {
  const expense = FixedExpense.create({ ...base(), description: '  Netflix  ' });
  assert.equal(expense.description, 'Netflix');
});

test('description so com espacos vira null', () => {
  const expense = FixedExpense.create({ ...base(), description: '   ' });
  assert.equal(expense.description, null);
});
