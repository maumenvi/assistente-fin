import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClassifyTransactionUseCase } from '../../../src/app/transaction/classify.transaction.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { TransactionNotFoundError } from '../../../src/domain/transaction/transaction.not.found.error.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';
import { fakeCategories, DEFAULT_CATEGORY_ID } from '../../support/fake.categories.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const makeUseCase = async () => {
  const transactions = new FakeTransactionRepository();
  const categories = fakeCategories('u1', { 'cat-mercado': 'Mercado' });
  const ids = new SequentialIdGenerator('cat');
  await transactions.save(
    Transaction.create({
      id: 't1',
      userId: 'u1',
      date: new Date('2026-01-05T10:00:00.000Z'),
      amount: Money.fromCents(5_000),
      type: 'expense',
      // nasce vinculada a padrao = pendente de classificacao (spec 003, CA-7)
      categoryId: DEFAULT_CATEGORY_ID,
      accountId: 'acc1',
    }),
  );
  return { transactions, categories, useCase: new ClassifyTransactionUseCase(transactions, categories, ids) };
};

test('classificar troca o vinculo de categoria da transacao (RF-13, CA-12)', async () => {
  const { transactions, useCase } = await makeUseCase();

  const classified = await useCase.execute({ userId: 'u1', id: 't1', categoryId: 'cat-mercado' });

  assert.equal(classified.categoryId, 'cat-mercado');
  assert.equal((await transactions.findById('u1', 't1'))?.categoryId, 'cat-mercado');
});

test('classificar por nome novo cria a categoria e vincula (CA-9)', async () => {
  const { categories, useCase } = await makeUseCase();

  const classified = await useCase.execute({ userId: 'u1', id: 't1', categoryName: 'lazer' });

  const created = await categories.findById('u1', classified.categoryId);
  assert.equal(created?.name.value, 'LAZER');
});

test('permite reclassificar uma transacao ja categorizada', async () => {
  const { useCase } = await makeUseCase();

  await useCase.execute({ userId: 'u1', id: 't1', categoryId: 'cat-mercado' });
  const reclassified = await useCase.execute({ userId: 'u1', id: 't1', categoryName: 'Lazer' });

  assert.notEqual(reclassified.categoryId, 'cat-mercado');
});

test('transacao inexistente ou de outro usuario vira TransactionNotFoundError (CA-14)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', id: 'inexistente', categoryName: 'Mercado' }),
    TransactionNotFoundError,
  );
  await assert.rejects(
    useCase.execute({ userId: 'u2', id: 't1', categoryName: 'Mercado' }),
    TransactionNotFoundError,
  );
});

test('sem categoria (nem id nem nome) vira InvalidInputError - seria um no-op (RF-13)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ userId: 'u1', id: 't1' }), InvalidInputError);
});

test('entrada invalida vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: '', id: '', categoryName: 'x' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'classificar transacao');
      assert.ok(error.fieldErrors['userId']);
      assert.ok(error.fieldErrors['id']);
      return true;
    },
  );
});
