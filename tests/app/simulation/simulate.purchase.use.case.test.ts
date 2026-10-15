import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SimulatePurchaseUseCase } from '../../../src/app/simulation/simulate.purchase.use.case.ts';
import { GetMonthlyForecastUseCase } from '../../../src/app/forecast/get.monthly.forecast.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { FakeSimulationRepository } from '../../../src/database/fake/simulation.repository.fake.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { FakeAccountRepository } from '../../../src/database/fake/account.repository.fake.ts';
import { FakeIncomeRepository } from '../../../src/database/fake/income.repository.fake.ts';
import { FakeFixedExpenseRepository } from '../../../src/database/fake/fixed.expense.repository.fake.ts';
import { FakeSpendingLimitRepository } from '../../../src/database/fake/spending.limit.repository.fake.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { fakeCategories, DEFAULT_CATEGORY_ID } from '../../support/fake.categories.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const makeUseCase = async (options: { withAccount?: boolean } = {}) => {
  const { withAccount = true } = options;
  const simulations = new FakeSimulationRepository();
  const users = new FakeUserRepository();
  const accounts = new FakeAccountRepository();
  const incomes = new FakeIncomeRepository();
  const fixedExpenses = new FakeFixedExpenseRepository();
  const spendingLimits = new FakeSpendingLimitRepository();
  const transactions = new FakeTransactionRepository();

  // usuario nao verificado de proposito - simular nao exige (decisao 9/13 do plano)
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

  if (withAccount) {
    await accounts.save(
      Account.create({
        id: 'acc1',
        userId: 'u1',
        name: 'Carteira',
        kind: 'checking',
        openingBalance: Money.zero(),
      }),
    );
  }

  const categories = fakeCategories('u1', { 'cat-eletronicos': 'Eletronicos', 'cat-trabalho': 'Trabalho' });

  const getMonthlyForecast = new GetMonthlyForecastUseCase(
    users,
    incomes,
    fixedExpenses,
    spendingLimits,
    transactions,
    accounts,
    categories,
  );
  const useCase = new SimulatePurchaseUseCase(
    simulations,
    users,
    accounts,
    categories,
    new SequentialIdGenerator('sim'),
    getMonthlyForecast,
  );

  return { simulations, users, accounts, incomes, categories, useCase };
};

const validInput = {
  userId: 'u1',
  amountCents: 30_000,
  date: '2026-01-05T10:00:00.000Z',
  categoryName: 'Eletronicos',
  payment: 'credit-card',
  accountId: 'acc1',
};

test('a vista: persiste a simulacao e devolve um unico impacto com saldo antes/depois (CA-8, RF-10)', async () => {
  const { simulations, incomes, useCase } = await makeUseCase();
  await incomes.save(
    Income.create({
      id: 'i1',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(500_000),
      source: 'Salario',
      recurrence: Recurrence.none(),
      categoryId: 'cat-trabalho',
    }),
  );

  const result = await useCase.execute(validInput);

  assert.equal(result.simulation.id, 'sim-1');
  assert.equal(result.impacts.length, 1);
  assert.equal(result.impacts[0]!.amount.cents, 30_000);
  assert.equal(result.impacts[0]!.projectedBalanceBefore.cents, 500_000);
  assert.equal(result.impacts[0]!.projectedBalanceAfter.cents, 470_000);
  assert.ok(await simulations.findById('u1', 'sim-1'), 'persistiu a simulacao');
});

test('parcelada: um impacto por parcela, cada mes com seu saldo (CA-9)', async () => {
  const { useCase } = await makeUseCase();

  const result = await useCase.execute({ ...validInput, installments: 3 });

  assert.equal(result.impacts.length, 3);
  const total = result.impacts.reduce((sum, impact) => sum + impact.amount.cents, 0);
  assert.equal(total, 30_000);
});

test('recorrente: um impacto por mes ativo dentro do horizonte (CA-10)', async () => {
  const { useCase } = await makeUseCase();

  const result = await useCase.execute({
    ...validInput,
    recurrence: { frequency: 'mensal', endDate: '2026-12-15T00:00:00.000Z' },
    horizonMonths: 6,
  });

  assert.equal(result.impacts.length, 6);
  assert.equal(result.simulation.isRecurring(), true);
});

test('entrada invalida vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...validInput, amountCents: -1, payment: 'boleto' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'simular compra');
      assert.ok(error.fieldErrors['amountCents']);
      assert.ok(error.fieldErrors['payment']);
      return true;
    },
  );
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ ...validInput, userId: 'inexistente' }), UserNotFoundError);
});

test('conta inexistente (ou de outro usuario) vira AccountNotFoundError', async () => {
  const { useCase } = await makeUseCase({ withAccount: false });

  await assert.rejects(useCase.execute(validInput), AccountNotFoundError);
});
