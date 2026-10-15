import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeleteManyTransactionsUseCase } from '../../../src/app/transaction/delete.many.transactions.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';

const plain = (id: string, userId: string, date: string) =>
  Transaction.create({
    id,
    userId,
    date: new Date(date),
    amount: Money.fromCents(1_000),
    type: 'expense',
    categoryId: 'cat1',
    accountId: 'acc1',
  });

const makeUseCase = () => {
  const transactions = new FakeTransactionRepository();
  const useCase = new DeleteManyTransactionsUseCase(transactions);
  return { transactions, useCase };
};

test('exclui exatamente os ids informados, sem afetar os demais', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(plain('t1', 'u1', '2026-01-15T00:00:00.000Z'));
  await transactions.save(plain('t2', 'u1', '2026-02-15T00:00:00.000Z'));
  await transactions.save(plain('t3', 'u1', '2026-03-15T00:00:00.000Z'));

  const result = await useCase.execute({ userId: 'u1', ids: ['t1', 't3'] });

  assert.equal(result.deletedCount, 2);
  assert.deepEqual(new Set(result.deletedIds), new Set(['t1', 't3']));
  assert.equal(await transactions.findById('u1', 't1'), null);
  assert.equal(await transactions.findById('u1', 't3'), null);
  assert.ok(await transactions.findById('u1', 't2'));
});

test('ignora silenciosamente ids inexistentes ou de outro usuario', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(plain('t1', 'u1', '2026-01-15T00:00:00.000Z'));
  await transactions.save(plain('t2', 'u2', '2026-01-15T00:00:00.000Z'));

  const result = await useCase.execute({ userId: 'u1', ids: ['t1', 't2', 'inexistente'] });

  assert.equal(result.deletedCount, 1);
  assert.deepEqual(result.deletedIds, ['t1']);
  assert.ok(await transactions.findById('u2', 't2'), 'transacao de outro usuario nao foi tocada');
});

test('entrada invalida (lista vazia) vira InvalidInputError', async () => {
  const { useCase } = makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', ids: [] }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'excluir varias transacoes');
      return true;
    },
  );
});
