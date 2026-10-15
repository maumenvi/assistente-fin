import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GetMonthlyForecastUseCase } from '../../../src/app/forecast/get.monthly.forecast.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
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

  const useCase = new GetMonthlyForecastUseCase(
    users,
    incomes,
    fixedExpenses,
    spendingLimits,
    transactions,
    accounts,
    categories,
  );
  return { users, incomes, fixedExpenses, spendingLimits, transactions, accounts, categories, useCase };
};

test('monta o ForecastInputs a partir dos repositorios e calcula a previsao (RF-7)', async () => {
  const { incomes, transactions, useCase } = await makeUseCase();

  await incomes.save(
    Income.create({
      id: 'i1',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(500_000),
      source: 'Salario',
      recurrence: monthlyFrom('2026-01-05T00:00:00.000Z'),
      categoryId: 'Trabalho',
    }),
  );
  await transactions.save(
    Transaction.create({
      id: 't1',
      userId: 'u1',
      date: new Date('2026-02-10T00:00:00.000Z'),
      amount: Money.fromCents(30_000),
      type: 'expense',
      categoryId: 'Mercado',
      accountId: 'acc1',
    }),
  );
  // transacao de income nao deveria contar como "gasto nao-fixo estimado"
  await transactions.save(
    Transaction.create({
      id: 't2',
      userId: 'u1',
      date: new Date('2026-02-10T00:00:00.000Z'),
      amount: Money.fromCents(999_999),
      type: 'income',
      categoryId: 'Extra',
      accountId: 'acc1',
    }),
  );

  const result = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 4 } });

  assert.equal(result.month.toString(), '2026-04');
  assert.equal(result.projectedIncome.cents, 500_000);
  assert.equal(result.categories.some((c) => c.categoryId === 'Extra'), false, 'nao mistura income com expense');
  assert.ok(result.categories.some((c) => c.categoryId === 'Mercado'));
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'inexistente', month: { year: 2026, month: 4 } }),
    UserNotFoundError,
  );
});

test('entrada invalida vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', month: { year: 1900, month: 13 } }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'obter previsao do mes');
      return true;
    },
  );
});

test('inclui a fatura de cartao de credito cujo vencimento cai no mes projetado (spec 008, RF-6)', async () => {
  const { accounts, transactions, useCase } = await makeUseCase();

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
  // fechamento 25/mar, vencimento 10/abr (dueDay <= closingDay -> mes seguinte) ->
  // periodo de apuracao [26/fev, 24/mar]
  await transactions.save(
    Transaction.create({
      id: 't-card',
      userId: 'u1',
      date: new Date('2026-03-20T00:00:00.000Z'),
      amount: Money.fromCents(45_000),
      type: 'expense',
      categoryId: 'Cartao',
      accountId: 'card1',
    }),
  );

  const result = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 4 } });

  assert.equal(result.projectedCreditCardInvoices.cents, 45_000);
  // spec 018, RF-27a: a despesa de conta-cartao NAO entra de novo na media movel da
  // categoria "Cartao" - conta exclusivamente via projectedCreditCardInvoices, senao a mesma
  // compra seria descontada duas vezes do saldo projetado (bug corrigido nesta spec).
  assert.equal(result.estimatedNonFixedExpenses.cents, 0);
  assert.equal(result.categories.length, 0);
  assert.equal(result.projectedBalance.cents, -result.projectedCreditCardInvoices.cents);
});

test('despesa de conta-cartao nao conta duas vezes: exclusivamente via projectedCreditCardInvoices, nunca tambem na categoria (spec 018, RF-27a, criterio 7)', async () => {
  const { accounts, transactions, useCase } = await makeUseCase();

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
  // mesmo periodo de apuracao do teste acima: [26/fev, 24/mar] -> fatura vence em abril
  await transactions.save(
    Transaction.create({
      id: 't-card-mercado',
      userId: 'u1',
      date: new Date('2026-03-20T00:00:00.000Z'),
      amount: Money.fromCents(10_000),
      type: 'expense',
      categoryId: 'cat-mercado',
      accountId: 'card1',
    }),
  );

  const result = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 4 } });

  assert.equal(result.projectedCreditCardInvoices.cents, 10_000);
  assert.equal(
    result.categories.find((c) => c.categoryId === 'cat-mercado'),
    undefined,
    'despesa de conta-cartao nao deveria aparecer entre as categorias projetadas',
  );
  assert.equal(result.estimatedNonFixedExpenses.cents, 0);
});

test('regressao: despesa de conta comum continua entrando normalmente na media movel de categoria (spec 018, RF-27a)', async () => {
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
  // 3 meses de historico (janela padrao) na categoria "cat-mercado", pra media movel > 0
  for (const monthNum of [1, 2, 3]) {
    await transactions.save(
      Transaction.create({
        id: `t-checking-${monthNum}`,
        userId: 'u1',
        date: new Date(`2026-0${monthNum}-10T00:00:00.000Z`),
        amount: Money.fromCents(10_000),
        type: 'expense',
        categoryId: 'cat-mercado',
        accountId: 'checking1',
      }),
    );
  }

  const result = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 4 } });

  const category = result.categories.find((c) => c.categoryId === 'cat-mercado');
  assert.ok(category, 'categoria "cat-mercado" deveria aparecer nas categorias projetadas');
  assert.equal(category.movingAverage.cents, 10_000);
  assert.equal(result.estimatedNonFixedExpenses.cents, 10_000);
});

test('recalcula automaticamente: pedir de novo depois de mudar dados reflete o novo estado (RF-8, CA-7)', async () => {
  const { incomes, useCase } = await makeUseCase();

  const before = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 4 } });
  assert.equal(before.projectedIncome.cents, 0);

  await incomes.save(
    Income.create({
      id: 'i1',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(200_000),
      source: 'Freela',
      recurrence: monthlyFrom('2026-01-05T00:00:00.000Z'),
      categoryId: 'Trabalho',
    }),
  );

  const after = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 4 } });
  assert.equal(after.projectedIncome.cents, 200_000);
});

test('gasto fixo conta UMA vez: a transacao vinculada nao infla a media de categoria (spec 021, RF-61)', async () => {
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
  // historico das marcacoes de "pago" feitas antes da spec 021: o app nao cria mais
  // transacoes assim (RF-58), mas as que existem nao podem contar de novo por categoria
  for (const monthNum of [1, 2, 3]) {
    await transactions.save(
      Transaction.create({
        id: `tx-legado-${monthNum}`,
        userId: 'u1',
        date: new Date(`2026-0${monthNum}-10T00:00:00.000Z`),
        amount: Money.fromCents(35_000),
        type: 'expense',
        categoryId: 'cat-aluguel',
        accountId: 'checking1',
        fixedExpenseId: 'fx-1',
      }),
    );
  }

  const result = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 4 } });

  assert.equal(result.projectedFixedExpenses.cents, 35_000, 'contado como gasto fixo');
  assert.equal(
    result.categories.find((c) => c.categoryId === 'cat-aluguel'),
    undefined,
    'e NAO de novo pela media de categoria',
  );
  assert.equal(result.estimatedNonFixedExpenses.cents, 0);
});

test('despesa comum continua entrando na media de categoria (regressao, spec 021)', async () => {
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
    }),
  );
  for (const monthNum of [1, 2, 3]) {
    await transactions.save(
      Transaction.create({
        id: `t-comum-${monthNum}`,
        userId: 'u1',
        date: new Date(`2026-0${monthNum}-10T00:00:00.000Z`),
        amount: Money.fromCents(10_000),
        type: 'expense',
        categoryId: 'cat-mercado',
        accountId: 'checking1',
      }),
    );
  }

  const result = await useCase.execute({ userId: 'u1', month: { year: 2026, month: 4 } });

  assert.equal(result.projectedFixedExpenses.cents, 35_000);
  assert.equal(result.estimatedNonFixedExpenses.cents, 10_000, 'a despesa comum nao foi afetada');
});
