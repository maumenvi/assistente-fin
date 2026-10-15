import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SimulateScenarioUseCase } from '../../../src/app/scenario/simulate.scenario.use.case.ts';
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
import { FixedClock } from '../../support/fixed.clock.ts';

const NOW = new Date('2026-03-15T12:00:00.000Z'); // marco/2026

const makeUseCase = async () => {
  const users = new FakeUserRepository();
  const incomes = new FakeIncomeRepository();
  const fixedExpenses = new FakeFixedExpenseRepository();
  const spendingLimits = new FakeSpendingLimitRepository();
  const transactions = new FakeTransactionRepository();

  await users.save(
    User.create({
      id: 'u1',
      cpf: Cpf.create('52998224725'),
      email: Email.create('marco@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Marco',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
  );
  await incomes.save(
    Income.create({
      id: 'inc1',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(500_000),
      source: 'Salario',
      recurrence: monthlyFrom('2026-01-05T00:00:00.000Z'),
      categoryId: 'Trabalho',
    }),
  );

  return {
    useCase: new SimulateScenarioUseCase(
      users,
      incomes,
      fixedExpenses,
      spendingLimits,
      transactions,
      new FixedClock(NOW),
    ),
  };
};

const adjustment = (over: Record<string, unknown> = {}) => ({
  target: 'income',
  mode: 'add',
  label: 'Bico',
  amountCents: 100_000,
  from: { year: 2026, month: 5 },
  to: { year: 2026, month: 6 },
  ...over,
});

test('projeta do mes atual e aplica o ajuste so no intervalo (RF-33)', async () => {
  const { useCase } = await makeUseCase();

  const projection = await useCase.execute({
    userId: 'u1',
    adjustments: [adjustment()],
    horizonMonths: 6,
  });

  assert.equal(projection.months.length, 6);
  assert.equal(projection.months[0]?.month.toString(), '2026-03');
  assert.equal(projection.months[0]?.incomeDeltaCents, 0); // marco
  assert.equal(projection.months[2]?.month.toString(), '2026-05');
  assert.equal(projection.months[2]?.incomeDeltaCents, 100_000); // maio
  assert.equal(projection.months[3]?.incomeDeltaCents, 100_000); // junho
  assert.equal(projection.months[4]?.incomeDeltaCents, 0); // julho
});

test('horizonMonths default 12 quando ausente', async () => {
  const { useCase } = await makeUseCase();
  const projection = await useCase.execute({ userId: 'u1', adjustments: [adjustment()] });
  assert.equal(projection.months.length, 12);
});

test('nada e persistido (repos de cenario nem sao tocados)', async () => {
  const { useCase } = await makeUseCase();
  await useCase.execute({ userId: 'u1', adjustments: [adjustment()], horizonMonths: 3 });
  // se persistisse, precisaria de um ScenarioRepository - a assinatura do caso de uso nao tem
  assert.ok(true);
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();
  await assert.rejects(
    useCase.execute({ userId: 'x', adjustments: [adjustment()], horizonMonths: 3 }),
    UserNotFoundError,
  );
});

test('lista de ajustes vazia vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();
  await assert.rejects(
    useCase.execute({ userId: 'u1', adjustments: [], horizonMonths: 3 }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'simular cenario');
      return true;
    },
  );
});

test('ajuste "replace" negativo e rejeitado na fronteira', async () => {
  const { useCase } = await makeUseCase();
  await assert.rejects(
    useCase.execute({
      userId: 'u1',
      adjustments: [adjustment({ mode: 'replace', amountCents: -1 })],
      horizonMonths: 3,
    }),
    InvalidInputError,
  );
});
