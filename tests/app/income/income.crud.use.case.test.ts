import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ListIncomesUseCase } from '../../../src/app/income/list.income.use.case.ts';
import { UpdateIncomeUseCase } from '../../../src/app/income/update.income.use.case.ts';
import { DeleteIncomeUseCase } from '../../../src/app/income/delete.income.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { IncomeNotFoundError } from '../../../src/domain/income/income.not.found.error.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { FakeIncomeRepository } from '../../../src/database/fake/income.repository.fake.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { fakeCategories } from '../../support/fake.categories.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const income = (id: string, userId: string) =>
  Income.create({
    id,
    userId,
    date: new Date('2026-01-05T00:00:00.000Z'),
    amount: Money.fromCents(500_000),
    source: 'Salario',
    recurrence: Recurrence.none(),
    categoryId: 'cat-trabalho',
  });

const setup = async () => {
  const incomes = new FakeIncomeRepository();
  const categories = fakeCategories('u1', { 'cat-trabalho': 'Trabalho' });
  const transactions = new FakeTransactionRepository();
  const ids = new SequentialIdGenerator('cat');
  await incomes.save(income('i1', 'u1'));
  await incomes.save(income('i2', 'u1'));
  await incomes.save(income('i3', 'u2'));
  return {
    incomes,
    categories,
    list: new ListIncomesUseCase(incomes, categories, transactions),
    update: new UpdateIncomeUseCase(incomes, categories, ids),
    del: new DeleteIncomeUseCase(incomes),
  };
};

test('list devolve so os ganhos do usuario', async () => {
  const { list } = await setup();
  const rows = await list.execute({ userId: 'u1' });
  assert.deepEqual(rows.map((r) => r.item.id).sort(), ['i1', 'i2']);
});

test('list inclui launchedMonths por Income (spec 012, RF-3/RF-6/RF-10, Q4)', async () => {
  const { incomes, list } = await setup();
  const transactions = new FakeTransactionRepository();
  await transactions.save(
    Transaction.create({
      id: 'tx-jan',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(500_000),
      type: 'income',
      categoryId: 'cat-trabalho',
      accountId: 'acc1',
      incomeId: 'i1',
    }),
  );
  await transactions.save(
    Transaction.create({
      id: 'tx-mar',
      userId: 'u1',
      date: new Date('2026-03-05T00:00:00.000Z'),
      amount: Money.fromCents(500_000),
      type: 'income',
      categoryId: 'cat-trabalho',
      accountId: 'acc1',
      incomeId: 'i1',
    }),
  );
  const listWithTransactions = new ListIncomesUseCase(
    incomes,
    fakeCategories('u1', { 'cat-trabalho': 'Trabalho' }),
    transactions,
  );

  const rows = await listWithTransactions.execute({ userId: 'u1' });
  const i1 = rows.find((r) => r.item.id === 'i1');
  const i2 = rows.find((r) => r.item.id === 'i2');
  assert.deepEqual([...i1!.launchedMonths].sort(), ['2026-01', '2026-03']);
  assert.deepEqual(i2!.launchedMonths, [], 'sem lancamento -> array vazio');
});

test('update aplica so os campos enviados e preserva o resto', async () => {
  const { incomes, update } = await setup();
  const updated = await update.execute({
    userId: 'u1',
    id: 'i1',
    amountCents: 700_000,
    categoryName: 'Bonus',
  });

  assert.equal(updated.amount.cents, 700_000);
  // nome novo vira categoria nova e o ganho passa a apontar pra ela (CA-9)
  assert.notEqual(updated.categoryId, 'cat-trabalho');
  assert.equal(updated.source, 'Salario', 'preservado');
  assert.equal((await incomes.findById('u1', 'i1'))?.amount.cents, 700_000);
});

test('update sem accountId no input preserva o vinculo atual (spec 012, RF-14)', async () => {
  const { incomes, update } = await setup();
  await incomes.save(
    Income.create({
      id: 'i-with-account',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(500_000),
      source: 'Salario',
      recurrence: Recurrence.none(),
      categoryId: 'cat-trabalho',
      accountId: 'acc1',
    }),
  );

  const updated = await update.execute({ userId: 'u1', id: 'i-with-account', amountCents: 600_000 });

  assert.equal(updated.accountId, 'acc1', 'accountId nao pode ser perdido quando nao enviado');
});

test('update com accountId novo vincula a conta', async () => {
  const { incomes, update } = await setup();

  const updated = await update.execute({ userId: 'u1', id: 'i1', accountId: 'acc1' });

  assert.equal(updated.accountId, 'acc1');
  assert.equal((await incomes.findById('u1', 'i1'))?.accountId, 'acc1');
});

test('update com accountId null desvincula a conta', async () => {
  const { incomes, update } = await setup();
  await incomes.save(
    Income.create({
      id: 'i-with-account-2',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(500_000),
      source: 'Salario',
      recurrence: Recurrence.none(),
      categoryId: 'cat-trabalho',
      accountId: 'acc1',
    }),
  );

  const updated = await update.execute({ userId: 'u1', id: 'i-with-account-2', accountId: null });

  assert.equal(updated.accountId, null);
});

test('update em ganho de outro usuario vira IncomeNotFoundError', async () => {
  const { update } = await setup();
  await assert.rejects(
    update.execute({ userId: 'u1', id: 'i3', amountCents: 1 }),
    IncomeNotFoundError,
  );
});

test('update com expectedUpdatedAt desatualizado vira StaleDataError (RF-31)', async () => {
  const { incomes, update } = await setup();
  const seen = (await incomes.findById('u1', 'i1'))!;
  const seenAt = seen.updatedAt!.toISOString();

  await update.execute({ userId: 'u1', id: 'i1', amountCents: 600_000, expectedUpdatedAt: seenAt });

  await assert.rejects(
    update.execute({ userId: 'u1', id: 'i1', amountCents: 700_000, expectedUpdatedAt: seenAt }),
    StaleDataError,
  );
});

test('delete remove e devolve o ganho; idempotencia protegida por IncomeNotFoundError', async () => {
  const { incomes, del } = await setup();
  const removed = await del.execute({ userId: 'u1', id: 'i1' });
  assert.equal(removed.id, 'i1');
  assert.equal(await incomes.findById('u1', 'i1'), null);
  await assert.rejects(del.execute({ userId: 'u1', id: 'i1' }), IncomeNotFoundError);
});

test('delete de um Income com Transaction ja lancada NAO apaga nem desvincula o historico (spec 012, RF-9)', async () => {
  const { incomes, del } = await setup();
  const transactions = new FakeTransactionRepository();
  await transactions.save(
    Transaction.create({
      id: 'tx-1',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(500_000),
      type: 'income',
      categoryId: 'cat-trabalho',
      accountId: 'acc1',
      incomeId: 'i1',
    }),
  );

  await del.execute({ userId: 'u1', id: 'i1' });

  assert.equal(await incomes.findById('u1', 'i1'), null, 'Income removido');
  const preserved = await transactions.findById('u1', 'tx-1');
  assert.ok(preserved, 'Transaction ja lancada permanece intacta');
  assert.equal(preserved?.incomeId, 'i1', 'incomeId preservado, mesmo apontando pra um Income que nao existe mais');
});

test('entrada invalida vira InvalidInputError', async () => {
  const { update } = await setup();
  await assert.rejects(
    update.execute({ userId: 'u1', id: 'i1', amountCents: -5 }),
    (e: unknown) => {
      assert.ok(e instanceof InvalidInputError);
      assert.equal(e.context, 'atualizar ganho');
      return true;
    },
  );
});
