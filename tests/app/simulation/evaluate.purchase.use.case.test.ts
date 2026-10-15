import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EvaluatePurchaseUseCase } from '../../../src/app/simulation/evaluate.purchase.use.case.ts';
import { CalculateCreditCardAvailableLimitUseCase } from '../../../src/app/credit-card/calculate.credit.card.available.limit.use.case.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { AccountArchivedError } from '../../../src/domain/account/account.archived.error.ts';
import { CreditCardTermsNotConfiguredError } from '../../../src/domain/credit-card/credit.card.terms.not.configured.error.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const NOW = new Date('2026-09-15T12:00:00.000Z');

async function setup() {
  const db = new FakeDatabase();
  await db.accounts.save(
    Account.create({ id: 'itau', userId: 'u1', name: 'Itau', kind: 'checking', openingBalance: Money.zero() }),
  );
  await db.accounts.save(
    Account.create({ id: 'nubank', userId: 'u1', name: 'Nubank', kind: 'credit-card', openingBalance: Money.zero(), creditLimit: Money.fromCents(500_000), closingDay: 5, dueDay: 12 }),
  );
  await db.accounts.save(
    Account.create({ id: 'sem-dados', userId: 'u1', name: 'Novo', kind: 'credit-card', openingBalance: Money.zero(), creditLimit: Money.fromCents(100_000) }),
  );
  await db.transactions.save(
    Transaction.create({ id: 's', userId: 'u1', date: new Date('2026-09-05T12:00:00Z'), amount: Money.fromCents(300_000), type: 'income', categoryId: 'c', accountId: 'itau' }),
  );
  await db.transactions.save(
    Transaction.create({ id: 'aluguel', userId: 'u1', date: new Date('2026-10-10T12:00:00Z'), amount: Money.fromCents(250_000), type: 'expense', categoryId: 'c', accountId: 'itau' }),
  );
  const clock = new FixedClock(NOW);
  return { db, useCase: new EvaluatePurchaseUseCase(db, clock, new CalculateCreditCardAvailableLimitUseCase(db.accounts, db.transactions, clock)) };
}

test('usa os lancamentos futuros: cabe em setembro mas estoura em outubro', async () => {
  const { useCase } = await setup();
  const result = await useCase.execute({ userId: 'u1', amountCents: 80_000, accountId: 'itau' });
  assert.equal(result.withoutPending.level, 'not-possible');
  assert.deepEqual(result.withoutPending.month, { year: 2026, month: 10 });
});

test('com pre-registros pendentes devolve os dois resultados (FR-043)', async () => {
  const { db, useCase } = await setup();
  await db.preRegistrations.save(
    PreRegistration.create({ id: 'p', userId: 'u1', origin: 'voice', createdAt: NOW, amount: Money.fromCents(20_000), accountId: 'itau' }),
  );
  const result = await useCase.execute({ userId: 'u1', amountCents: 10_000, accountId: 'itau' });
  assert.ok(result.withPending);
  assert.ok(result.withPending.remainingCents < result.withoutPending.remainingCents);
});

test('cartao sem fechamento/vencimento e conta arquivada viram erro (U1, U2)', async () => {
  const { db, useCase } = await setup();
  await assert.rejects(useCase.execute({ userId: 'u1', amountCents: 100, accountId: 'sem-dados' }), CreditCardTermsNotConfiguredError);
  const itau = await db.accounts.findById('u1', 'itau');
  assert.ok(itau);
  await db.accounts.save(itau.archive());
  await assert.rejects(useCase.execute({ userId: 'u1', amountCents: 100, accountId: 'itau' }), AccountArchivedError);
});
