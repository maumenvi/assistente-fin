import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GetForecastRangeUseCase } from '../../../src/app/forecast/get.forecast.range.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { monthlyFrom } from '../../support/recurrence.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { FakeIncomeRepository } from '../../../src/database/fake/income.repository.fake.ts';
import { FakeFixedExpenseRepository } from '../../../src/database/fake/fixed.expense.repository.fake.ts';
import { FakeSpendingLimitRepository } from '../../../src/database/fake/spending.limit.repository.fake.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';
import { FakeAccountRepository } from '../../../src/database/fake/account.repository.fake.ts';
import { FakeCategoryRepository } from '../../../src/database/fake/category.repository.fake.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { FixedExpense } from '../../../src/domain/fixed-expense/fixed.expense.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const makeUseCase = async () => {
  const users = new FakeUserRepository();
  const incomes = new FakeIncomeRepository();
  const fixedExpenses = new FakeFixedExpenseRepository();
  const spendingLimits = new FakeSpendingLimitRepository();
  const transactions = new FakeTransactionRepository();
  const accounts = new FakeAccountRepository();
  const categories = new FakeCategoryRepository();

  await users.save(
    User.create({
      id: 'u1',
      cpf: Cpf.create('52998224725'),
      email: Email.create('marco@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Marco',
      createdAt: NOW,
    }),
  );

  const useCase = new GetForecastRangeUseCase(
    users,
    incomes,
    fixedExpenses,
    spendingLimits,
    transactions,
    accounts,
    categories,
  );
  return { users, incomes, fixedExpenses, transactions, accounts, categories, useCase };
};

test('projeta `months` meses seguidos a partir de `from`, do mais antigo ao mais novo', async () => {
  const { incomes, useCase } = await makeUseCase();
  await incomes.save(
    Income.create({
      id: 'i1',
      userId: 'u1',
      date: new Date('2026-11-01T00:00:00.000Z'),
      amount: Money.fromCents(500_000),
      source: 'Salario',
      recurrence: monthlyFrom('2026-11-01T00:00:00.000Z'),
      categoryId: 'Trabalho',
    }),
  );

  const months = await useCase.execute({
    userId: 'u1',
    from: { year: 2026, month: 11 },
    months: 4,
  });

  assert.equal(months.length, 4);
  assert.deepEqual(
    months.map((m) => `${m.month.year}-${m.month.month}`),
    ['2026-11', '2026-12', '2027-1', '2027-2'],
  );
  assert.ok(months.every((m) => m.projectedIncome.cents === 500_000));
});

test('cada mes reflete o mesmo estado carregado uma vez (baseline == forecast do mes)', async () => {
  const { useCase } = await makeUseCase();
  const months = await useCase.execute({ userId: 'u1', from: { year: 2026, month: 1 }, months: 12 });
  assert.equal(months.length, 12);
  assert.ok(months.every((m) => m.projectedBalance.cents === 0));
});

test('cada mes do range reflete a fatura de cartao de credito com vencimento naquele mes (spec 008, RF-6)', async () => {
  const { transactions, accounts, useCase } = await makeUseCase();
  await accounts.save(
    Account.create({
      id: 'card1',
      userId: 'u1',
      name: 'Cartao',
      kind: 'credit-card',
      openingBalance: Money.zero(),
      creditLimit: Money.fromCents(1_000_000),
      closingDay: 25,
      dueDay: 10,
    }),
  );
  // fechamento 25/nov, vencimento 10/dez (dueDay <= closingDay -> mes seguinte) ->
  // periodo de apuracao [26/out, 24/nov]
  await transactions.save(
    Transaction.create({
      id: 't-card',
      userId: 'u1',
      date: new Date('2026-11-20T00:00:00.000Z'),
      amount: Money.fromCents(20_000),
      type: 'expense',
      categoryId: 'Cartao',
      accountId: 'card1',
    }),
  );

  const months = await useCase.execute({
    userId: 'u1',
    from: { year: 2026, month: 11 },
    months: 4,
  });

  const december = months.find((m) => m.month.year === 2026 && m.month.month === 12);
  const january = months.find((m) => m.month.year === 2027 && m.month.month === 1);
  assert.equal(december?.projectedCreditCardInvoices.cents, 20_000);
  assert.equal(january?.projectedCreditCardInvoices.cents, 0);
});

test('despesa de conta-cartao nao conta duas vezes ao longo do range: exclusivamente via projectedCreditCardInvoices (spec 018, RF-27a, criterio 7)', async () => {
  const { transactions, accounts, useCase } = await makeUseCase();
  await accounts.save(
    Account.create({
      id: 'card1',
      userId: 'u1',
      name: 'Cartao',
      kind: 'credit-card',
      openingBalance: Money.zero(),
      creditLimit: Money.fromCents(1_000_000),
      closingDay: 25,
      dueDay: 10,
    }),
  );
  await transactions.save(
    Transaction.create({
      id: 't-card-mercado',
      userId: 'u1',
      date: new Date('2026-11-20T00:00:00.000Z'),
      amount: Money.fromCents(20_000),
      type: 'expense',
      categoryId: 'cat-mercado',
      accountId: 'card1',
    }),
  );

  const months = await useCase.execute({
    userId: 'u1',
    from: { year: 2026, month: 11 },
    months: 4,
  });

  for (const month of months) {
    assert.equal(
      month.categories.find((c) => c.categoryId === 'cat-mercado'),
      undefined,
      `mes ${month.month.year}-${month.month.month}: despesa de conta-cartao nao deveria aparecer entre as categorias projetadas`,
    );
  }
  const december = months.find((m) => m.month.year === 2026 && m.month.month === 12);
  assert.equal(december?.projectedCreditCardInvoices.cents, 20_000);
});

test('regressao: despesa de conta comum continua entrando normalmente ao longo do range (spec 018, RF-27a)', async () => {
  const { transactions, accounts, useCase } = await makeUseCase();
  await accounts.save(
    Account.create({
      id: 'checking1',
      userId: 'u1',
      name: 'Conta corrente',
      kind: 'checking',
      openingBalance: Money.zero(),
    }),
  );
  await transactions.save(
    Transaction.create({
      id: 't-checking-mercado',
      userId: 'u1',
      date: new Date('2026-11-20T00:00:00.000Z'),
      amount: Money.fromCents(20_000),
      type: 'expense',
      categoryId: 'cat-mercado',
      accountId: 'checking1',
    }),
  );

  const months = await useCase.execute({
    userId: 'u1',
    from: { year: 2026, month: 11 },
    months: 4,
  });

  assert.ok(
    months.every((m) => m.categories.some((c) => c.categoryId === 'cat-mercado')),
    'despesa de conta comum deveria aparecer entre as categorias projetadas em todo o range',
  );
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();
  await assert.rejects(
    useCase.execute({ userId: 'nao-existe', from: { year: 2026, month: 1 }, months: 3 }),
    UserNotFoundError,
  );
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();
  await assert.rejects(
    useCase.execute({ userId: 'u1', from: { year: 2026, month: 1 }, months: 0 }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'obter previsao do periodo');
      return true;
    },
  );
});

test('gasto fixo conta UMA vez em cada mes do intervalo (spec 021, RF-61)', async () => {
  const { accounts, fixedExpenses, transactions, useCase } = await makeUseCase();

  await accounts.save(
    Account.create({
      id: 'checking1',
      userId: 'u1',
      name: 'Conta corrente',
      kind: 'checking',
      openingBalance: Money.zero(),
    }),
  );
  await fixedExpenses.save(
    FixedExpense.create({
      id: 'fx-1',
      userId: 'u1',
      dueDay: 10,
      expectedAmount: Money.fromCents(35_000),
      categoryId: 'cat-aluguel',
      accountId: 'checking1',
    }).markAsPaid(),
  );
  // historico de uma marcacao feita antes da spec 021
  await transactions.save(
    Transaction.create({
      id: 'tx-legado',
      userId: 'u1',
      date: new Date('2026-01-10T00:00:00.000Z'),
      amount: Money.fromCents(35_000),
      type: 'expense',
      categoryId: 'cat-aluguel',
      accountId: 'checking1',
      fixedExpenseId: 'fx-1',
    }),
  );

  const months = await useCase.execute({ userId: 'u1', from: { year: 2026, month: 1 }, months: 3 });

  for (const month of months) {
    assert.equal(month.projectedFixedExpenses.cents, 35_000, 'contado como gasto fixo');
    assert.equal(
      month.categories.find((c) => c.categoryId === 'cat-aluguel'),
      undefined,
      'e NAO de novo pela media de categoria',
    );
  }
});

test('despesa comum continua entrando na media de categoria do intervalo (regressao, spec 021)', async () => {
  const { accounts, transactions, useCase } = await makeUseCase();

  await accounts.save(
    Account.create({
      id: 'checking1',
      userId: 'u1',
      name: 'Conta corrente',
      kind: 'checking',
      openingBalance: Money.zero(),
    }),
  );
  await transactions.save(
    Transaction.create({
      id: 't-comum',
      userId: 'u1',
      date: new Date('2026-01-10T00:00:00.000Z'),
      amount: Money.fromCents(10_000),
      type: 'expense',
      categoryId: 'cat-mercado',
      accountId: 'checking1',
    }),
  );

  const months = await useCase.execute({ userId: 'u1', from: { year: 2026, month: 1 }, months: 2 });

  assert.ok(
    months.some((m) => m.categories.some((c) => c.categoryId === 'cat-mercado')),
    'a despesa comum continua alimentando a media de categoria',
  );
});
