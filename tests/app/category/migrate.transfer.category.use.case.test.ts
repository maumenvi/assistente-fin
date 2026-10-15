import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MigrateTransferCategoryUseCase } from '../../../src/app/category/migrate.transfer.category.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { AmbiguousTransferCategoryError } from '../../../src/domain/category/ambiguous.transfer.category.error.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const makeUseCase = () => {
  const database = new FakeDatabase();
  const useCase = new MigrateTransferCategoryUseCase(database, new SequentialIdGenerator('id'));
  return { database, useCase };
};

test('0 candidatas: cria a categoria de sistema do zero (spec 016, RF-10)', async () => {
  const { database, useCase } = await makeUseCase();
  await database.categories.save(
    Category.create({ id: 'c1', userId: 'u1', name: CategoryName.create('Mercado') }),
  );

  const result = await useCase.execute({ userId: 'u1' });

  assert.equal(result.outcome, 'created');
  assert.equal(result.category.isSystemTransfer, true);
  assert.equal(result.category.name.value, 'TRANSFERÊNCIAS');
  assert.equal((await database.categories.listByUser('u1')).length, 2);
});

test('1 candidata: promove ela mesma, preservando o id (nenhum lancamento e tocado)', async () => {
  const { database, useCase } = await makeUseCase();
  await database.categories.save(
    Category.create({ id: 'c1', userId: 'u1', name: CategoryName.create('TRANSFERÊNCIAS') }),
  );
  await database.transactions.save(
    Transaction.create({
      id: 't1',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(1_000),
      type: 'expense',
      categoryId: 'c1',
      accountId: 'acc1',
    }),
  );

  const result = await useCase.execute({ userId: 'u1' });

  assert.equal(result.outcome, 'promoted');
  assert.equal(result.category.id, 'c1');
  assert.equal(result.category.isSystemTransfer, true);
  assert.equal((await database.categories.listByUser('u1')).length, 1);

  const transaction = await database.transactions.findById('u1', 't1');
  assert.equal(transaction?.categoryId, 'c1', 'lancamento continua vinculado ao mesmo id');
});

test('1 candidata: preserva as demais flags/isDefault ao promover', async () => {
  const { database, useCase } = await makeUseCase();
  await database.categories.save(
    Category.create({
      id: 'c1',
      userId: 'u1',
      name: CategoryName.create('TRANSFERÊNCIAS'),
      isDefault: true,
    }),
  );

  const result = await useCase.execute({ userId: 'u1' });

  assert.equal(result.category.isDefault, true);
  assert.equal(result.category.isSystemTransfer, true);
});

test('2+ candidatas: nao escolhe nem mescla, lanca AmbiguousTransferCategoryError com diagnostico', async () => {
  const { database, useCase } = await makeUseCase();
  await database.categories.save(
    Category.create({ id: 'c1', userId: 'u1', name: CategoryName.create('TRANSFERÊNCIAS') }),
  );
  await database.categories.save(
    Category.create({ id: 'c2', userId: 'u1', name: CategoryName.create('TRANSFERÊNCIAS') }),
  );
  await database.transactions.save(
    Transaction.create({
      id: 't1',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(1_000),
      type: 'expense',
      categoryId: 'c1',
      accountId: 'acc1',
    }),
  );

  await assert.rejects(
    useCase.execute({ userId: 'u1' }),
    (error: unknown) => {
      assert.ok(error instanceof AmbiguousTransferCategoryError);
      assert.equal(error.candidates.length, 2);
      const byId = new Map(error.candidates.map((c) => [c.categoryId, c]));
      assert.equal(byId.get('c1')?.transactionCount, 1);
      assert.equal(byId.get('c2')?.transactionCount, 0);
      return true;
    },
  );

  // nenhuma categoria foi tocada
  const categories = await database.categories.listByUser('u1');
  assert.equal(categories.length, 2);
  assert.ok(categories.every((c) => c.isSystemTransfer === false));
});

test('nao confunde categorias de usuarios diferentes ao contar candidatas', async () => {
  const { database, useCase } = await makeUseCase();
  await database.categories.save(
    Category.create({ id: 'c1', userId: 'u1', name: CategoryName.create('TRANSFERÊNCIAS') }),
  );
  await database.categories.save(
    Category.create({ id: 'c2', userId: 'u2', name: CategoryName.create('TRANSFERÊNCIAS') }),
  );

  const result = await useCase.execute({ userId: 'u1' });

  assert.equal(result.outcome, 'promoted');
  assert.equal(result.category.id, 'c1');
});

test('e idempotente: rodar de novo depois de promovida nao cria nem falha', async () => {
  const { database, useCase } = await makeUseCase();
  await database.categories.save(
    Category.create({ id: 'c1', userId: 'u1', name: CategoryName.create('TRANSFERÊNCIAS') }),
  );

  await useCase.execute({ userId: 'u1' });
  const second = await useCase.execute({ userId: 'u1' });

  assert.equal(second.outcome, 'promoted');
  assert.equal(second.category.id, 'c1');
  assert.equal((await database.categories.listByUser('u1')).length, 1);
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'migrar categoria de transferencia');
      return true;
    },
  );
});
