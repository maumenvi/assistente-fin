import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeleteTransferUseCase } from '../../../src/app/transaction/delete.transfer.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { TransferNotFoundError } from '../../../src/domain/transaction/transfer.not.found.error.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';

const leg = (
  id: string,
  userId: string,
  type: 'expense' | 'income',
  accountId: string,
  groupId = 'transfer-1',
) =>
  Transaction.create({
    id,
    userId,
    date: new Date('2026-01-05T00:00:00.000Z'),
    amount: Money.fromCents(60_000),
    type,
    categoryId: 'cat1',
    accountId,
    transferGroupId: groupId,
  });

const makeUseCase = () => {
  const database = new FakeDatabase();
  const useCase = new DeleteTransferUseCase(database);
  return { transactions: database.transactions, useCase };
};

test('exclui as duas pontas juntas, nunca deixando uma orfa (spec 016, RF-5)', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(leg('t1', 'u1', 'expense', 'acc1'));
  await transactions.save(leg('t2', 'u1', 'income', 'acc2'));

  const result = await useCase.execute({ userId: 'u1', transactionId: 't1' });

  assert.equal(result.deletedCount, 2);
  assert.equal(await transactions.findById('u1', 't1'), null);
  assert.equal(await transactions.findById('u1', 't2'), null);
});

test('excluir a partir da perna de entrada tambem remove as duas', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(leg('t1', 'u1', 'expense', 'acc1'));
  await transactions.save(leg('t2', 'u1', 'income', 'acc2'));

  const result = await useCase.execute({ userId: 'u1', transactionId: 't2' });

  assert.equal(result.deletedCount, 2);
  assert.equal(await transactions.findById('u1', 't1'), null);
});

test('nao afeta transferencias de outro grupo', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(leg('t1', 'u1', 'expense', 'acc1', 'transfer-1'));
  await transactions.save(leg('t2', 'u1', 'income', 'acc2', 'transfer-1'));
  await transactions.save(leg('t3', 'u1', 'expense', 'acc1', 'transfer-2'));
  await transactions.save(leg('t4', 'u1', 'income', 'acc2', 'transfer-2'));

  await useCase.execute({ userId: 'u1', transactionId: 't1' });

  assert.ok(await transactions.findById('u1', 't3'));
  assert.ok(await transactions.findById('u1', 't4'));
});

test('transacao que nao e transferencia (transferGroupId nulo) vira TransferNotFoundError', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(
    Transaction.create({
      id: 'common-1',
      userId: 'u1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      amount: Money.fromCents(1_000),
      type: 'expense',
      categoryId: 'cat1',
      accountId: 'acc1',
    }),
  );

  await assert.rejects(
    useCase.execute({ userId: 'u1', transactionId: 'common-1' }),
    TransferNotFoundError,
  );
});

test('transacao de outro usuario (ou inexistente) vira TransferNotFoundError (CA-14)', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(leg('t1', 'u2', 'expense', 'acc1'));

  await assert.rejects(
    useCase.execute({ userId: 'u1', transactionId: 't1' }),
    TransferNotFoundError,
  );
  await assert.rejects(
    useCase.execute({ userId: 'u1', transactionId: 'inexistente' }),
    TransferNotFoundError,
  );
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: '', transactionId: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'excluir transferencia');
      return true;
    },
  );
});
