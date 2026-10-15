import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpendingLimit } from '../../../src/domain/spending-limit/spending.limit.entity.ts';
import { InvalidSpendingLimitError } from '../../../src/domain/spending-limit/invalid.spending.limit.error.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

const base = () => ({
  id: 'sl-1',
  userId: 'user-1',
  categoryId: '  Lazer  ',
  period: Month.create({ year: 2026, month: 1 }),
  maxAmount: Money.fromCents(50_000),
});

test('create normaliza category e preserva os demais campos (RF-4)', () => {
  const limit = SpendingLimit.create(base());

  assert.equal(limit.categoryId, 'Lazer');
  assert.equal(limit.period.toString(), '2026-01');
  assert.equal(limit.maxAmount.cents, 50_000);
});

test('create rejeita campos invalidos', () => {
  assert.throws(() => SpendingLimit.create({ ...base(), id: '' }), InvalidSpendingLimitError);
  assert.throws(() => SpendingLimit.create({ ...base(), categoryId: '  ' }), InvalidSpendingLimitError);
  assert.throws(
    // @ts-expect-error period invalido de proposito
    () => SpendingLimit.create({ ...base(), period: '2026-01' }),
    InvalidSpendingLimitError,
  );
  assert.throws(
    () => SpendingLimit.create({ ...base(), maxAmount: Money.zero() }),
    InvalidSpendingLimitError,
  );
  assert.throws(
    () => SpendingLimit.create({ ...base(), maxAmount: Money.fromCents(-100) }),
    InvalidSpendingLimitError,
  );
});

test('fromPersistence reaplica as mesmas invariantes de create (defesa em profundidade)', () => {
  const limit = SpendingLimit.fromPersistence(base());
  assert.equal(limit.categoryId, 'Lazer');

  assert.throws(() => SpendingLimit.fromPersistence({ ...base(), id: '' }), InvalidSpendingLimitError);
});
