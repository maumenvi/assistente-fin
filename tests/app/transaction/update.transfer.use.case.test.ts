import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UpdateTransferUseCase } from '../../../src/app/transaction/update.transfer.use.case.ts';
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
    notes: 'Original',
    transferGroupId: groupId,
  });

const makeUseCase = async () => {
  const database = new FakeDatabase();
  await database.transactions.save(leg('t1', 'u1', 'expense', 'acc1'));
  await database.transactions.save(leg('t2', 'u1', 'income', 'acc2'));

  const useCase = new UpdateTransferUseCase(database);
  return { transactions: database.transactions, useCase };
};

test('atualiza data e notas das duas pernas atomicamente (spec 016, decisao do usuario)', async () => {
  const { transactions, useCase } = await makeUseCase();

  const result = await useCase.execute({
    userId: 'u1',
    transactionId: 't1',
    date: '2026-01-10T00:00:00.000Z',
    notes: 'Atualizado',
  });

  assert.equal(result.outgoing.date.toISOString(), '2026-01-10T00:00:00.000Z');
  assert.equal(result.incoming.date.toISOString(), '2026-01-10T00:00:00.000Z');
  assert.equal(result.outgoing.notes, 'Atualizado');
  assert.equal(result.incoming.notes, 'Atualizado');

  const persistedOutgoing = await transactions.findById('u1', 't1');
  const persistedIncoming = await transactions.findById('u1', 't2');
  assert.equal(persistedOutgoing?.date.toISOString(), '2026-01-10T00:00:00.000Z');
  assert.equal(persistedIncoming?.date.toISOString(), '2026-01-10T00:00:00.000Z');
});

test('campo ausente mantem o valor atual (mesma semantica de UpdateTransactionUseCase)', async () => {
  const { useCase } = await makeUseCase();

  const result = await useCase.execute({ userId: 'u1', transactionId: 't1', notes: 'So notas' });

  assert.equal(result.outgoing.date.toISOString(), '2026-01-05T00:00:00.000Z');
  assert.equal(result.outgoing.notes, 'So notas');
});

test('preserva valor, contas e transferGroupId - nunca aceita amountCents (nao existe no schema)', async () => {
  const { useCase } = await makeUseCase();

  const result = await useCase.execute({ userId: 'u1', transactionId: 't1', notes: 'x' });

  assert.equal(result.outgoing.amount.cents, 60_000);
  assert.equal(result.incoming.amount.cents, 60_000);
  assert.equal(result.outgoing.accountId, 'acc1');
  assert.equal(result.incoming.accountId, 'acc2');
  assert.equal(result.outgoing.transferGroupId, result.incoming.transferGroupId);
});

test('atualizar a partir da perna de entrada tambem atualiza as duas', async () => {
  const { useCase } = await makeUseCase();

  const result = await useCase.execute({ userId: 'u1', transactionId: 't2', notes: 'Via entrada' });

  assert.equal(result.outgoing.notes, 'Via entrada');
  assert.equal(result.incoming.notes, 'Via entrada');
});

test('transacao que nao e transferencia (transferGroupId nulo) vira TransferNotFoundError', async () => {
  const database = new FakeDatabase();
  await database.transactions.save(
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
  const useCase = new UpdateTransferUseCase(database);

  await assert.rejects(
    useCase.execute({ userId: 'u1', transactionId: 'common-1', notes: 'x' }),
    TransferNotFoundError,
  );
});

test('transacao de outro usuario (ou inexistente) vira TransferNotFoundError (CA-14)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u2', transactionId: 't1', notes: 'x' }),
    TransferNotFoundError,
  );
  await assert.rejects(
    useCase.execute({ userId: 'u1', transactionId: 'inexistente', notes: 'x' }),
    TransferNotFoundError,
  );
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: '', transactionId: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'atualizar transferencia');
      return true;
    },
  );
});
