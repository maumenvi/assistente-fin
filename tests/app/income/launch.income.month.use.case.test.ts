import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LaunchIncomeMonthUseCase } from '../../../src/app/income/launch.income.month.use.case.ts';
import { IncomeNotFoundError } from '../../../src/domain/income/income.not.found.error.ts';
import { IncomeWithoutAccountError } from '../../../src/domain/income/income.without.account.error.ts';
import { IncomeMonthAlreadyLaunchedError } from '../../../src/domain/income/income.month.already.launched.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const ANCHOR = new Date('2026-01-31T00:00:00.000Z');

const makeUseCase = async (
  options: { withAccount?: boolean; recurrence?: Recurrence; date?: Date } = {},
) => {
  const { withAccount = true, recurrence = Recurrence.none(), date = ANCHOR } = options;
  const database = new FakeDatabase();

  await database.accounts.save(
    Account.create({
      id: 'acc1',
      userId: 'u1',
      name: 'Conta Corrente',
      kind: 'checking',
      openingBalance: Money.zero(),
    }),
  );

  const income = Income.create({
    id: 'income-1',
    userId: 'u1',
    date,
    amount: Money.fromCents(500_000),
    source: 'Salario',
    recurrence,
    categoryId: 'cat-trabalho',
    notes: 'nota',
    accountId: withAccount ? 'acc1' : undefined,
  });
  await database.incomes.save(income);

  const useCase = new LaunchIncomeMonthUseCase(database, new SequentialIdGenerator('tx'));
  return { database, useCase, income };
};

test('cria a Transaction vinculada no mes pedido (RF-3)', async () => {
  const { database, useCase } = await makeUseCase();

  const transaction = await useCase.execute({
    userId: 'u1',
    incomeId: 'income-1',
    month: { year: 2026, month: 1 },
  });

  assert.equal(transaction.incomeId, 'income-1');
  assert.equal(transaction.type, 'income');
  assert.equal(transaction.amount.cents, 500_000);
  assert.equal(transaction.categoryId, 'cat-trabalho');
  assert.equal(transaction.accountId, 'acc1');
  assert.equal(transaction.notes, 'nota');
  assert.equal(transaction.date.toISOString(), '2026-01-31T00:00:00.000Z');

  const saved = await database.transactions.findById('u1', transaction.id);
  assert.ok(saved);
});

test('clampa o dia-ancora quando o mes-alvo nao tem esse dia', async () => {
  const { useCase } = await makeUseCase({
    recurrence: Recurrence.create({ frequency: 'mensal', endDate: new Date('2026-12-31T00:00:00.000Z') }),
  });

  const transaction = await useCase.execute({
    userId: 'u1',
    incomeId: 'income-1',
    month: { year: 2026, month: 2 },
  });

  assert.equal(transaction.date.toISOString(), '2026-02-28T00:00:00.000Z');
});

test('Income inexistente vira IncomeNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', incomeId: 'inexistente', month: { year: 2026, month: 1 } }),
    IncomeNotFoundError,
  );
});

test('Income sem accountId vira IncomeWithoutAccountError (RF-4)', async () => {
  const { useCase } = await makeUseCase({ withAccount: false });

  await assert.rejects(
    useCase.execute({ userId: 'u1', incomeId: 'income-1', month: { year: 2026, month: 1 } }),
    IncomeWithoutAccountError,
  );
});

test('lancar o mesmo mes duas vezes vira IncomeMonthAlreadyLaunchedError (RF-7)', async () => {
  const { useCase } = await makeUseCase();

  await useCase.execute({ userId: 'u1', incomeId: 'income-1', month: { year: 2026, month: 1 } });

  await assert.rejects(
    useCase.execute({ userId: 'u1', incomeId: 'income-1', month: { year: 2026, month: 1 } }),
    IncomeMonthAlreadyLaunchedError,
  );
});

test('meses diferentes do mesmo Income podem ser lancados independentemente', async () => {
  const { useCase } = await makeUseCase({
    recurrence: Recurrence.create({ frequency: 'mensal', endDate: new Date('2026-12-31T00:00:00.000Z') }),
  });

  const jan = await useCase.execute({
    userId: 'u1',
    incomeId: 'income-1',
    month: { year: 2026, month: 1 },
  });
  const fev = await useCase.execute({
    userId: 'u1',
    incomeId: 'income-1',
    month: { year: 2026, month: 2 },
  });

  assert.notEqual(jan.id, fev.id);
});

test('conta removida depois do vinculo vira AccountNotFoundError (defesa)', async () => {
  const { database, useCase } = await makeUseCase();
  await database.accounts.delete('u1', 'acc1');

  await assert.rejects(
    useCase.execute({ userId: 'u1', incomeId: 'income-1', month: { year: 2026, month: 1 } }),
    AccountNotFoundError,
  );
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ userId: '', incomeId: 'income-1', month: { year: 2026, month: 1 } }));
});
