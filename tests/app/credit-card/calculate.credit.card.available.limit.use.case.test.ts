import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CalculateCreditCardAvailableLimitUseCase } from '../../../src/app/credit-card/calculate.credit.card.available.limit.use.case.ts';
import { NotCreditCardAccountError } from '../../../src/domain/credit-card/not.credit.card.account.error.ts';
import { CreditCardTermsNotConfiguredError } from '../../../src/domain/credit-card/credit.card.terms.not.configured.error.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeAccountRepository } from '../../../src/database/fake/account.repository.fake.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';
import { FixedClock } from '../../support/fixed.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { addUtcMonths } from '../../../src/domain/shared/add.utc.months.ts';
import { buildInstallmentPlan } from '../../../src/domain/money/split.evenly.ts';

const NOW = new Date('2026-01-20T00:00:00.000Z'); // antes do vencimento do dia 25/jan

const expense = (id: string, date: string, cents: number) =>
  Transaction.create({
    id,
    userId: 'u1',
    date: new Date(date),
    amount: Money.fromCents(cents),
    type: 'expense' as const,
    categoryId: 'cat1',
    accountId: 'acc1',
  });

const setup = async (creditLimitCents = 100_000) => {
  const accounts = new FakeAccountRepository();
  const transactions = new FakeTransactionRepository();
  const account = Account.create({
    id: 'acc1',
    userId: 'u1',
    name: 'Cartao',
    kind: 'credit-card',
    openingBalance: Money.zero(),
    creditLimit: Money.fromCents(creditLimitCents),
    closingDay: 15,
    dueDay: 25,
  });
  await accounts.save(account);
  const useCase = new CalculateCreditCardAvailableLimitUseCase(accounts, transactions, new FixedClock(NOW));
  return { accounts, transactions, useCase };
};

test('limite disponivel = limite - soma das despesas em aberto (RF-7)', async () => {
  const { transactions, useCase } = await setup(100_000);
  // periodo em aberto (fechamento 15/dez em diante, ciclo cujo vencimento e 25/jan)
  await transactions.save(expense('t1', '2026-01-05T10:00:00.000Z', 30_000));
  await transactions.save(expense('t2', '2025-12-01T10:00:00.000Z', 9_999)); // ja vencido, fora

  const available = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  assert.equal(available.cents, 70_000);
});

test('inclui despesas lancadas em mes futuro (ainda em aberto, sem limite superior)', async () => {
  const { transactions, useCase } = await setup(100_000);
  await transactions.save(expense('t1', '2026-01-05T10:00:00.000Z', 30_000));
  await transactions.save(expense('t2', '2026-03-01T10:00:00.000Z', 10_000)); // futuro, ainda em aberto

  const available = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  assert.equal(available.cents, 60_000);
});

test('compra parcelada em aberto: limite disponivel ja reflete o valor total (todas as parcelas), spec 014 CA-1', async () => {
  const { transactions, useCase } = await setup(1_000_000);
  const ids = new SequentialIdGenerator('inst');
  // compra em 6x a partir de 05/jan (dentro do ciclo aberto atual) - parcela 1 no ciclo
  // aberto, parcelas 2..6 futuras (fev..jun). O calculo existente (spec 008) ja soma tudo,
  // sem teto de data - este e o teste que teria pego o bug descrito na spec 014 se existisse
  // antes dela.
  const plan = buildInstallmentPlan(6_000, 6);
  const installmentGroupId = ids.next();
  const purchaseDate = new Date('2026-01-05T10:00:00.000Z');
  for (let index = 0; index < plan.length; index += 1) {
    await transactions.save(
      Transaction.create({
        id: ids.next(),
        userId: 'u1',
        date: addUtcMonths(purchaseDate, index),
        amount: Money.fromCents(plan[index]!),
        type: 'expense',
        categoryId: 'cat1',
        accountId: 'acc1',
        installmentGroupId,
        installmentNumber: index + 1,
        installmentTotal: plan.length,
      }),
    );
  }

  const available = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  const totalPurchase = plan.reduce((total, cents) => total + cents, 0);
  assert.equal(available.cents, 1_000_000 - totalPurchase);
});

test('resultado negativo quando as despesas em aberto ultrapassam o limite (CA-6)', async () => {
  const { transactions, useCase } = await setup(10_000);
  await transactions.save(expense('t1', '2026-01-05T10:00:00.000Z', 30_000));

  const available = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  assert.equal(available.cents, -20_000);
});

test('conta que nao e credit-card vira NotCreditCardAccountError', async () => {
  const accounts = new FakeAccountRepository();
  const transactions = new FakeTransactionRepository();
  await accounts.save(
    Account.create({
      id: 'acc1',
      userId: 'u1',
      name: 'Conta corrente',
      kind: 'checking',
      openingBalance: Money.zero(),
    }),
  );
  const useCase = new CalculateCreditCardAvailableLimitUseCase(accounts, transactions, new FixedClock(NOW));

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'acc1' }),
    NotCreditCardAccountError,
  );
});

test('conta credit-card sem termos configurados vira CreditCardTermsNotConfiguredError (decisao 4.4)', async () => {
  const accounts = new FakeAccountRepository();
  const transactions = new FakeTransactionRepository();
  await accounts.save(
    Account.create({
      id: 'acc1',
      userId: 'u1',
      name: 'Cartao sem termos',
      kind: 'credit-card',
      openingBalance: Money.zero(),
    }),
  );
  const useCase = new CalculateCreditCardAvailableLimitUseCase(accounts, transactions, new FixedClock(NOW));

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'acc1' }),
    CreditCardTermsNotConfiguredError,
  );
});
