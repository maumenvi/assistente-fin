import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CalculateCreditCardCommittedBalanceUseCase } from '../../../src/app/credit-card/calculate.credit.card.committed.balance.use.case.ts';
import { CalculateCreditCardAvailableLimitUseCase } from '../../../src/app/credit-card/calculate.credit.card.available.limit.use.case.ts';
import { CalculateCreditCardInvoiceUseCase } from '../../../src/app/credit-card/calculate.credit.card.invoice.use.case.ts';
import { NotCreditCardAccountError } from '../../../src/domain/credit-card/not.credit.card.account.error.ts';
import { CreditCardTermsNotConfiguredError } from '../../../src/domain/credit-card/credit.card.terms.not.configured.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeAccountRepository } from '../../../src/database/fake/account.repository.fake.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';
import { FixedClock } from '../../support/fixed.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { addUtcMonths } from '../../../src/domain/shared/add.utc.months.ts';
import { buildInstallmentPlan } from '../../../src/domain/money/split.evenly.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';

// fechamento dia 15, vencimento dia 25 -> ciclo aberto atual [15/dez, 14/jan], vence 25/jan.
const NOW = new Date('2026-01-20T00:00:00.000Z');

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

const setup = async (creditLimitCents = 1_000_000) => {
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
  const useCase = new CalculateCreditCardCommittedBalanceUseCase(accounts, transactions, new FixedClock(NOW));
  return { accounts, transactions, useCase };
};

const saveInstallments = async (
  transactions: FakeTransactionRepository,
  ids: SequentialIdGenerator,
  purchaseDate: Date,
  totalCents: number,
  count: number,
) => {
  const plan = buildInstallmentPlan(totalCents, count);
  const installmentGroupId = ids.next();
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
  return plan;
};

test('compra parcelada feita no ciclo aberto atual: saldo comprometido exclui a parcela do ciclo aberto (RF-2)', async () => {
  const { transactions, useCase } = await setup();
  const ids = new SequentialIdGenerator('inst');
  // compra em 6x a partir de 05/jan (dentro do ciclo aberto [15/dez, 14/jan]) - parcela 1
  // cai no ciclo aberto; parcelas 2..6 (fev..jun) sao futuras (> 14/jan).
  const plan = await saveInstallments(transactions, ids, new Date('2026-01-05T10:00:00.000Z'), 6_000, 6);

  const committed = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  const expectedCommitted = plan.slice(1).reduce((total, cents) => total + cents, 0);
  assert.equal(committed.amount.cents, expectedCommitted);
  assert.equal(committed.transactionCount, 5);
});

test('saldo comprometido + fatura do ciclo aberto == creditLimit - availableLimit (decomposicao sem alterar o total)', async () => {
  const accounts = new FakeAccountRepository();
  const transactions = new FakeTransactionRepository();
  const account = Account.create({
    id: 'acc1',
    userId: 'u1',
    name: 'Cartao',
    kind: 'credit-card',
    openingBalance: Money.zero(),
    creditLimit: Money.fromCents(1_000_000),
    closingDay: 15,
    dueDay: 25,
  });
  await accounts.save(account);
  const ids = new SequentialIdGenerator('inst');
  await saveInstallments(transactions, ids, new Date('2026-01-05T10:00:00.000Z'), 6_000, 6);
  await transactions.save(expense('common-1', '2026-01-08T10:00:00.000Z', 500)); // dentro do ciclo aberto

  const committedUseCase = new CalculateCreditCardCommittedBalanceUseCase(
    accounts,
    transactions,
    new FixedClock(NOW),
  );
  const availableUseCase = new CalculateCreditCardAvailableLimitUseCase(accounts, transactions, new FixedClock(NOW));
  const invoiceUseCase = new CalculateCreditCardInvoiceUseCase(accounts, transactions, new FixedClock(NOW));

  const committed = await committedUseCase.execute({ userId: 'u1', accountId: 'acc1' });
  const available = await availableUseCase.execute({ userId: 'u1', accountId: 'acc1' });
  const invoice = await invoiceUseCase.execute({ userId: 'u1', accountId: 'acc1' });

  const totalUnavailable = account.creditLimit!.subtract(available);
  assert.equal(committed.amount.cents + invoice.amount.cents, totalUnavailable.cents);
});

test('compra parcelada de ciclo anterior com parcelas ja vencidas e futuras: soma so as com date > openPeriod.to atual (RF-1)', async () => {
  const { transactions, useCase } = await setup();
  const ids = new SequentialIdGenerator('inst');
  // compra em 5x a partir de 05/nov/2025: parcelas nov, dez, jan, fev, mar.
  // ciclo aberto atual: [15/dez/2025, 14/jan/2026] - nov e dez ja vencidas (fora, ciclos
  // anteriores), jan cai no ciclo aberto atual, fev e mar sao futuras (comprometidas).
  const plan = await saveInstallments(transactions, ids, new Date('2025-11-05T10:00:00.000Z'), 5_000, 5);

  const committed = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  const expectedCommitted = plan[3]! + plan[4]!; // fev + mar
  assert.equal(committed.amount.cents, expectedCommitted);
  assert.equal(committed.transactionCount, 2);
});

test('despesa comum (nao-parcela) datada no futuro nao entra no saldo comprometido (RF-1)', async () => {
  const { transactions, useCase } = await setup();
  await transactions.save(expense('common-future', '2026-03-01T10:00:00.000Z', 10_000));

  const committed = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  assert.equal(committed.amount.cents, 0);
  assert.equal(committed.transactionCount, 0);
});

test('cartao sem nenhuma compra parcelada em aberto: saldo comprometido zero (RF-9)', async () => {
  const { transactions, useCase } = await setup();
  await transactions.save(expense('t1', '2026-01-05T10:00:00.000Z', 30_000)); // dentro do ciclo aberto, comum

  const committed = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  assert.equal(committed.amount.cents, 0);
  assert.equal(committed.transactionCount, 0);
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
  const useCase = new CalculateCreditCardCommittedBalanceUseCase(accounts, transactions, new FixedClock(NOW));

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'acc1' }),
    NotCreditCardAccountError,
  );
});

test('conta credit-card sem termos configurados vira CreditCardTermsNotConfiguredError', async () => {
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
  const useCase = new CalculateCreditCardCommittedBalanceUseCase(accounts, transactions, new FixedClock(NOW));

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'acc1' }),
    CreditCardTermsNotConfiguredError,
  );
});

test('conta de outro usuario vira AccountNotFoundError', async () => {
  const { transactions } = await setup();
  const accounts = new FakeAccountRepository();
  await accounts.save(
    Account.create({
      id: 'acc1',
      userId: 'u2',
      name: 'Cartao de outro usuario',
      kind: 'credit-card',
      openingBalance: Money.zero(),
      creditLimit: Money.fromCents(100_000),
      closingDay: 15,
      dueDay: 25,
    }),
  );
  const useCase = new CalculateCreditCardCommittedBalanceUseCase(accounts, transactions, new FixedClock(NOW));

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'acc1' }),
    AccountNotFoundError,
  );
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = await setup();

  await assert.rejects(
    useCase.execute({ userId: '', accountId: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      return true;
    },
  );
});
