import { test } from 'node:test';
import assert from 'node:assert/strict';
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

// fechamento dia 15, vencimento dia 25 -> vence no mesmo mes do fechamento (25 > 15).
const NOW = new Date('2026-01-20T00:00:00.000Z'); // entre o fechamento (15) e o vencimento (25) de jan

const setup = async (accountOverrides: Partial<Parameters<typeof Account.create>[0]> = {}) => {
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
    ...accountOverrides,
  });
  await accounts.save(account);
  const useCase = new CalculateCreditCardInvoiceUseCase(accounts, transactions, new FixedClock(NOW));
  return { accounts, transactions, useCase };
};

const expense = (id: string, date: string, cents: number, accountId = 'acc1') =>
  Transaction.create({
    id,
    userId: 'u1',
    date: new Date(date),
    amount: Money.fromCents(cents),
    type: 'expense' as const,
    categoryId: 'cat1',
    accountId,
  });

test('soma corretamente as despesas dentro do periodo de apuracao (RF-5)', async () => {
  const { transactions, useCase } = await setup();
  // periodo do ciclo cujo fechamento e 15/jan: [15/dez, 14/jan]
  await transactions.save(expense('t1', '2025-12-20T10:00:00.000Z', 5_000));
  await transactions.save(expense('t2', '2026-01-10T10:00:00.000Z', 3_000));

  const invoice = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  assert.equal(invoice.amount.cents, 8_000);
  assert.equal(invoice.transactionCount, 2);
  assert.equal(invoice.dueDate.toISOString(), '2026-01-25T00:00:00.000Z');
  assert.equal(invoice.closingDate.toISOString(), '2026-01-14T00:00:00.000Z');
});

test('exclui lancamentos fora do periodo de apuracao', async () => {
  const { transactions, useCase } = await setup();
  await transactions.save(expense('t1', '2026-01-05T10:00:00.000Z', 5_000)); // dentro
  await transactions.save(expense('t2', '2025-12-10T10:00:00.000Z', 9_999)); // antes do periodo
  await transactions.save(expense('t3', '2026-01-20T10:00:00.000Z', 9_999)); // depois (proximo periodo)

  const invoice = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  assert.equal(invoice.amount.cents, 5_000);
  assert.equal(invoice.transactionCount, 1);
});

test('lancamento no dia exato do fechamento nao entra no ciclo atual (RF-5a, regressao desta revisao)', async () => {
  const { transactions, useCase } = await setup();
  await transactions.save(expense('t1', '2026-01-10T10:00:00.000Z', 5_000)); // dentro
  await transactions.save(expense('t2', '2026-01-15T10:00:00.000Z', 9_999)); // no fechamento -> proximo ciclo

  const invoice = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  assert.equal(invoice.amount.cents, 5_000);
  assert.equal(invoice.transactionCount, 1);
});

test('lancamentos de receita na mesma conta nao entram na soma (RF-5 so fala em despesa)', async () => {
  const { transactions, useCase } = await setup();
  await transactions.save(expense('t1', '2026-01-05T10:00:00.000Z', 5_000));
  await transactions.save(
    Transaction.create({
      id: 't2',
      userId: 'u1',
      date: new Date('2026-01-06T10:00:00.000Z'),
      amount: Money.fromCents(50_000),
      type: 'income',
      categoryId: 'cat1',
      accountId: 'acc1',
    }),
  );

  const invoice = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  assert.equal(invoice.amount.cents, 5_000);
});

test('conta inexistente vira AccountNotFoundError', async () => {
  const { useCase } = await setup();

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'inexistente' }),
    AccountNotFoundError,
  );
});

test('conta que nao e credit-card vira NotCreditCardAccountError', async () => {
  const accounts = new FakeAccountRepository();
  const transactions = new FakeTransactionRepository();
  const account = Account.create({
    id: 'acc1',
    userId: 'u1',
    name: 'Conta corrente',
    kind: 'checking',
    openingBalance: Money.zero(),
  });
  await accounts.save(account);
  const useCase = new CalculateCreditCardInvoiceUseCase(accounts, transactions, new FixedClock(NOW));

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'acc1' }),
    NotCreditCardAccountError,
  );
});

test('conta credit-card sem creditLimit/closingDay/dueDay configurado vira CreditCardTermsNotConfiguredError (decisao 4.4)', async () => {
  const accounts = new FakeAccountRepository();
  const transactions = new FakeTransactionRepository();
  const account = Account.create({
    id: 'acc1',
    userId: 'u1',
    name: 'Cartao sem termos',
    kind: 'credit-card',
    openingBalance: Money.zero(),
  });
  await accounts.save(account);
  const useCase = new CalculateCreditCardInvoiceUseCase(accounts, transactions, new FixedClock(NOW));

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'acc1' }),
    CreditCardTermsNotConfiguredError,
  );
});

test('conta credit-card com closingDay configurado mas sem dueDay tambem vira CreditCardTermsNotConfiguredError', async () => {
  const accounts = new FakeAccountRepository();
  const transactions = new FakeTransactionRepository();
  const account = Account.create({
    id: 'acc1',
    userId: 'u1',
    name: 'Cartao parcialmente configurado',
    kind: 'credit-card',
    openingBalance: Money.zero(),
    creditLimit: Money.fromCents(1_000_000),
    closingDay: 15,
  });
  await accounts.save(account);
  const useCase = new CalculateCreditCardInvoiceUseCase(accounts, transactions, new FixedClock(NOW));

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'acc1' }),
    CreditCardTermsNotConfiguredError,
  );
});

test('parcelas de uma compra parcelada (spec 009) somam so na fatura do seu proprio periodo (CA-4)', async () => {
  const { transactions, useCase } = await setup();
  const ids = new SequentialIdGenerator('inst');
  // compra parcelada em 3x a partir de 05/jan - uma parcela por mes (jan, fev, mar), mesma
  // regra de data usada por RecordInstallmentPurchaseUseCase (addUtcMonths). O periodo de
  // apuracao do ciclo corrente (fechamento 15/jan) e [15/dez, 14/jan] - so a 1a parcela cai
  // nele; as demais (fev, mar) NAO devem entrar nesta fatura, confirmando que o calculo de
  // fatura (spec 008) nao precisa de nenhuma mudanca para lidar com parcelas (spec 009).
  const purchaseDate = new Date('2026-01-05T10:00:00.000Z');
  const plan = buildInstallmentPlan(3_000, 3);
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
  // lancamento comum, tambem dentro do periodo - soma junto (RF-6)
  await transactions.save(expense('common-1', '2026-01-08T10:00:00.000Z', 500));

  const invoice = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  // so a parcela 1/3 (05/jan, dentro de [15/dez, 14/jan]) + o lancamento comum
  assert.equal(invoice.transactionCount, 2);
  assert.equal(invoice.amount.cents, plan[0]! + 500);
});

test('com month explicito no passado, calcula a fatura cujo vencimento cai naquele mes (spec 011, decisao 4.3)', async () => {
  const { transactions, useCase } = await setup();
  // periodo do ciclo cujo vencimento e 25/nov/2025 (fechamento 15/nov -> [15/out, 14/nov]).
  await transactions.save(expense('t1', '2025-10-20T10:00:00.000Z', 5_000));
  await transactions.save(expense('t2', '2026-01-10T10:00:00.000Z', 9_999)); // fora do mes pedido

  const invoice = await useCase.execute({
    userId: 'u1',
    accountId: 'acc1',
    month: { year: 2025, month: 11 },
  });

  assert.equal(invoice.amount.cents, 5_000);
  assert.equal(invoice.transactionCount, 1);
  assert.equal(invoice.dueDate.toISOString(), '2025-11-25T00:00:00.000Z');
  assert.equal(invoice.closingDate.toISOString(), '2025-11-14T00:00:00.000Z');
});

test('com month explicito no futuro, calcula a fatura cujo vencimento cai naquele mes (spec 011, decisao 4.3)', async () => {
  const { transactions, useCase } = await setup();
  // periodo do ciclo cujo vencimento e 25/jun/2027 (fechamento 15/jun -> [15/mai, 14/jun]).
  await transactions.save(expense('t1', '2027-05-20T10:00:00.000Z', 7_000));

  const invoice = await useCase.execute({
    userId: 'u1',
    accountId: 'acc1',
    month: { year: 2027, month: 6 },
  });

  assert.equal(invoice.amount.cents, 7_000);
  assert.equal(invoice.dueDate.toISOString(), '2027-06-25T00:00:00.000Z');
});

test('sem month, o comportamento default (proximo ciclo a partir de agora) e preservado (teste de nao-quebra)', async () => {
  const { transactions, useCase } = await setup();
  await transactions.save(expense('t1', '2025-12-20T10:00:00.000Z', 5_000));
  await transactions.save(expense('t2', '2026-01-10T10:00:00.000Z', 3_000));

  const invoice = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  assert.equal(invoice.amount.cents, 8_000);
  assert.equal(invoice.transactionCount, 2);
  assert.equal(invoice.dueDate.toISOString(), '2026-01-25T00:00:00.000Z');
  assert.equal(invoice.closingDate.toISOString(), '2026-01-14T00:00:00.000Z');
});

test('quando o vencimento do mes corrente ja passou, projeta pro mes seguinte', async () => {
  const later = new Date('2026-01-26T00:00:00.000Z'); // vencimento (25) ja passou
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
  await transactions.save(expense('t1', '2026-01-16T10:00:00.000Z', 4_000)); // dentro do proximo periodo
  const useCase = new CalculateCreditCardInvoiceUseCase(accounts, transactions, new FixedClock(later));

  const invoice = await useCase.execute({ userId: 'u1', accountId: 'acc1' });

  assert.equal(invoice.dueDate.toISOString(), '2026-02-25T00:00:00.000Z');
  assert.equal(invoice.closingDate.toISOString(), '2026-02-14T00:00:00.000Z');
  assert.equal(invoice.amount.cents, 4_000);
});
