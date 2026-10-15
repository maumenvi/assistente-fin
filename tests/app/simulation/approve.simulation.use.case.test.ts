import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApproveSimulationUseCase } from '../../../src/app/simulation/approve.simulation.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { SimulationNotFoundError } from '../../../src/domain/simulation/simulation.not.found.error.ts';
import { SimulationNotRecurringError } from '../../../src/domain/simulation/simulation.not.recurring.error.ts';
import { SimulationAlreadyApprovedError } from '../../../src/domain/simulation/simulation.already.approved.error.ts';
import { PurchaseSimulation } from '../../../src/domain/simulation/simulation.entity.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const makeUseCase = async (
  options: {
    verified?: boolean;
    recurring?: boolean;
    simulationId?: string | null;
    installments?: number;
  } = {},
) => {
  const { verified = true, recurring = false, simulationId = 'sim1', installments = 1 } = options;
  const database = new FakeDatabase();
  await database.categories.save(
    Category.create({ id: 'cat-eletronicos', userId: 'u1', name: CategoryName.create('Eletronicos') }),
  );

  let user = User.create({
    id: 'u1',
    cpf: Cpf.create('52998224725'),
    email: Email.create('marco@exemplo.com'),
    phone: Phone.create('11987654321'),
    name: 'Marco',
    createdAt: NOW,
  });
  if (verified) user = user.verifyEmail(NOW).verifyPhone(NOW);
  await database.users.save(user);

  await database.accounts.save(
    Account.create({
      id: 'acc1',
      userId: 'u1',
      name: 'Carteira',
      kind: 'checking',
      openingBalance: Money.zero(),
    }),
  );

  if (simulationId) {
    await database.simulations.save(
      PurchaseSimulation.create({
        id: simulationId,
        userId: 'u1',
        amount: Money.fromCents(30_000),
        date: new Date('2026-01-15T00:00:00.000Z'),
        categoryId: 'cat-eletronicos',
        payment: 'credit-card',
        installments,
        recurrence: recurring
          ? Recurrence.create({ frequency: 'mensal', endDate: new Date('2027-01-15T00:00:00.000Z') })
          : Recurrence.none(),
        accountId: 'acc1',
      }),
    );
  }

  const useCase = new ApproveSimulationUseCase(
    database,
    new SequentialIdGenerator('gen'),
    new FixedClock(new Date('2026-01-16T00:00:00.000Z')),
  );

  return { database, useCase };
};

const validInput = (as: 'real' | 'planned') => ({ userId: 'u1', simulationId: 'sim1', as });

test("as: 'real' cria uma Transaction com o valor cheio e marca a simulacao aprovada (RF-11)", async () => {
  const { database, useCase } = await makeUseCase();

  const result = await useCase.execute(validInput('real'));

  assert.equal(result.as, 'real');
  if (result.as !== 'real') throw new Error('esperava as: real');
  assert.equal(result.transactions[0]!.amount.cents, 30_000);
  assert.equal(result.transactions[0]!.type, 'expense');
  assert.equal(result.simulation.approvedAt?.getTime(), new Date('2026-01-16T00:00:00.000Z').getTime());

  const persisted = await database.simulations.findById('u1', 'sim1');
  assert.ok(persisted?.approvedAt, 'simulacao persistida ja aprovada');
  assert.equal((await database.transactions.listByUser('u1')).length, 1);
});

test("as: 'real' com simulacao parcelada gera uma Transaction por parcela, nao 1 lancamento do valor cheio", async () => {
  const { database, useCase } = await makeUseCase({ installments: 3 });

  const result = await useCase.execute(validInput('real'));

  assert.equal(result.as, 'real');
  if (result.as !== 'real') throw new Error('esperava as: real');
  assert.equal(result.transactions.length, 3);
  assert.equal(
    result.transactions.reduce((total, t) => total + t.amount.cents, 0),
    30_000,
  );
  assert.deepEqual(
    result.transactions.map((t) => t.installmentNumber),
    [1, 2, 3],
  );
  assert.ok(result.transactions.every((t) => t.installmentTotal === 3));

  assert.equal((await database.transactions.listByUser('u1')).length, 3);
});

test("as: 'planned' com simulacao recorrente cria um FixedExpense (RF-11)", async () => {
  const { database, useCase } = await makeUseCase({ recurring: true });

  const result = await useCase.execute(validInput('planned'));

  assert.equal(result.as, 'planned');
  if (result.as !== 'planned') throw new Error('esperava as: planned');
  assert.equal(result.fixedExpense.expectedAmount.cents, 30_000);
  assert.equal(result.fixedExpense.dueDay, 15);
  assert.equal((await database.fixedExpenses.listByUser('u1')).length, 1);
});

test("as: 'planned' com simulacao nao recorrente vira SimulationNotRecurringError", async () => {
  const { useCase } = await makeUseCase({ recurring: false });

  await assert.rejects(useCase.execute(validInput('planned')), SimulationNotRecurringError);
});

test('aprovar de novo a mesma simulacao vira SimulationAlreadyApprovedError', async () => {
  const { useCase } = await makeUseCase();

  await useCase.execute(validInput('real'));

  await assert.rejects(useCase.execute(validInput('real')), SimulationAlreadyApprovedError);
});

test('entrada invalida vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', simulationId: 'sim1', as: 'invalido' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'aprovar simulacao');
      return true;
    },
  );
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ ...validInput('real'), userId: 'inexistente' }), UserNotFoundError);
});

test('usuario nao verificado vira UserNotVerifiedError (RF-28)', async () => {
  const { useCase } = await makeUseCase({ verified: false });

  await assert.rejects(useCase.execute(validInput('real')), UserNotVerifiedError);
});

test('simulacao inexistente (ou de outro usuario) vira SimulationNotFoundError', async () => {
  const { useCase } = await makeUseCase({ simulationId: null });

  await assert.rejects(useCase.execute(validInput('real')), SimulationNotFoundError);
});

test("as: 'real' copia o categoryId da simulacao para a Transaction (spec 003, RF-10)", async () => {
  const { useCase } = await makeUseCase();
  const result = await useCase.execute(validInput('real'));
  if (result.as !== 'real') throw new Error('esperava as: real');
  assert.equal(result.transactions[0]!.categoryId, 'cat-eletronicos');
});
