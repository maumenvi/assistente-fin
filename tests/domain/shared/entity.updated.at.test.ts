import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { FixedExpense } from '../../../src/domain/fixed-expense/fixed.expense.entity.ts';
import { SpendingLimit } from '../../../src/domain/spending-limit/spending.limit.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { PurchaseSimulation } from '../../../src/domain/simulation/simulation.entity.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';

const D = new Date('2026-03-04T05:06:07.000Z');
const NOW = new Date('2026-01-01T00:00:00.000Z');

/** Uma entidade recem-`create`, a mesma via `fromPersistence` com `updatedAt`, e um id. */
const cases: { name: string; fresh: () => { updatedAt: Date | null }; persisted: () => { updatedAt: Date | null }; roundtrip: (e: unknown) => { updatedAt: Date | null } }[] = [
  {
    name: 'Account',
    fresh: () => Account.create({ id: 'a1', userId: 'u1', name: 'C', kind: 'checking', openingBalance: Money.zero() }),
    persisted: () =>
      Account.fromPersistence({ id: 'a1', userId: 'u1', name: 'C', kind: 'checking', openingBalance: Money.zero(), archived: false, updatedAt: D }),
    roundtrip: (e) => (e as Account).withUpdatedAt(D),
  },
  {
    name: 'Income',
    fresh: () => Income.create({ id: 'i1', userId: 'u1', date: NOW, amount: Money.fromCents(100), source: 'S', recurrence: Recurrence.none(), categoryId: 'C' }),
    persisted: () =>
      Income.fromPersistence({ id: 'i1', userId: 'u1', date: NOW, amount: Money.fromCents(100), source: 'S', recurrence: Recurrence.none(), categoryId: 'C', updatedAt: D }),
    roundtrip: (e) => (e as Income).withUpdatedAt(D),
  },
  {
    name: 'FixedExpense',
    fresh: () => FixedExpense.create({ id: 'f1', userId: 'u1', dueDay: 5, expectedAmount: Money.fromCents(100), categoryId: 'C', accountId: 'a1' }),
    persisted: () =>
      FixedExpense.fromPersistence({ id: 'f1', userId: 'u1', dueDay: 5, expectedAmount: Money.fromCents(100), categoryId: 'C', accountId: 'a1', paid: false, updatedAt: D }),
    roundtrip: (e) => (e as FixedExpense).withUpdatedAt(D),
  },
  {
    name: 'SpendingLimit',
    fresh: () => SpendingLimit.create({ id: 's1', userId: 'u1', categoryId: 'C', period: Month.create({ year: 2026, month: 1 }), maxAmount: Money.fromCents(100) }),
    persisted: () =>
      SpendingLimit.fromPersistence({ id: 's1', userId: 'u1', categoryId: 'C', period: Month.create({ year: 2026, month: 1 }), maxAmount: Money.fromCents(100), updatedAt: D }),
    roundtrip: (e) => (e as SpendingLimit).withUpdatedAt(D),
  },
  {
    name: 'Transaction',
    fresh: () => Transaction.create({ id: 't1', userId: 'u1', date: NOW, amount: Money.fromCents(100), type: 'expense', categoryId: 'C', accountId: 'a1' }),
    persisted: () =>
      Transaction.fromPersistence({ id: 't1', userId: 'u1', date: NOW, amount: Money.fromCents(100), type: 'expense', categoryId: 'C', accountId: 'a1', updatedAt: D }),
    roundtrip: (e) => (e as Transaction).withUpdatedAt(D),
  },
  {
    name: 'PurchaseSimulation',
    fresh: () => PurchaseSimulation.create({ id: 'sim1', userId: 'u1', amount: Money.fromCents(100), date: NOW, categoryId: 'C', payment: 'pix', installments: 1, recurrence: Recurrence.none(), accountId: 'a1' }),
    persisted: () =>
      PurchaseSimulation.fromPersistence({ id: 'sim1', userId: 'u1', amount: Money.fromCents(100), date: NOW, categoryId: 'C', payment: 'pix', installments: 1, recurrence: Recurrence.none(), accountId: 'a1', approvedAt: null, updatedAt: D }),
    roundtrip: (e) => (e as PurchaseSimulation).withUpdatedAt(D),
  },
  {
    name: 'User',
    fresh: () => User.create({ id: 'u1', cpf: Cpf.create('52998224725'), email: Email.create('a@b.com'), phone: Phone.create('11987654321'), name: 'N', createdAt: NOW }),
    persisted: () =>
      User.fromPersistence({ id: 'u1', cpf: Cpf.create('52998224725'), email: Email.create('a@b.com'), phone: Phone.create('11987654321'), name: 'N', createdAt: NOW, emailVerifiedAt: null, phoneVerifiedAt: null, updatedAt: D }),
    roundtrip: (e) => (e as User).withUpdatedAt(D),
  },
];

for (const c of cases) {
  test(`${c.name}: create nasce com updatedAt null; fromPersistence e withUpdatedAt carregam o valor (RF-31)`, () => {
    assert.equal(c.fresh().updatedAt, null, 'create -> null');
    assert.equal(c.persisted().updatedAt?.getTime(), D.getTime(), 'fromPersistence -> valor');
    assert.equal(c.roundtrip(c.fresh()).updatedAt?.getTime(), D.getTime(), 'withUpdatedAt -> valor');
    assert.equal(c.roundtrip(c.persisted()).updatedAt, D, 'withUpdatedAt preserva a instancia passada');
  });
}
