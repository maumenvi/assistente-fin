import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UpdateCardPaymentUseCase } from '../../../src/app/transaction/update.card.payment.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { CardPaymentNotFoundError } from '../../../src/domain/transaction/card.payment.not.found.error.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';

const leg = (
  id: string,
  userId: string,
  type: 'expense' | 'income',
  accountId: string,
  groupId = 'payment-1',
) =>
  Transaction.create({
    id,
    userId,
    date: new Date('2026-01-05T00:00:00.000Z'),
    amount: Money.fromCents(249_788),
    type,
    categoryId: 'cat1',
    accountId,
    notes: 'Original',
    cardPaymentGroupId: groupId,
  });

const makeUseCase = async () => {
  const database = new FakeDatabase();
  await database.transactions.save(leg('t1', 'u1', 'expense', 'acc-pri'));
  await database.transactions.save(leg('t2', 'u1', 'income', 'acc-cartao'));

  const useCase = new UpdateCardPaymentUseCase(database);
  return { transactions: database.transactions, useCase };
};

test('atualiza data e notas das duas pernas atomicamente (spec 016, decisao do usuario)', async () => {
  const { useCase } = await makeUseCase();

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
});

test('preserva valor, contas e cardPaymentGroupId - nunca aceita amountCents (nao existe no schema)', async () => {
  const { useCase } = await makeUseCase();

  const result = await useCase.execute({ userId: 'u1', transactionId: 't1', notes: 'x' });

  assert.equal(result.outgoing.amount.cents, 249_788);
  assert.equal(result.incoming.amount.cents, 249_788);
  assert.equal(result.outgoing.accountId, 'acc-pri');
  assert.equal(result.incoming.accountId, 'acc-cartao');
  assert.equal(result.outgoing.cardPaymentGroupId, result.incoming.cardPaymentGroupId);
});

test('transacao que nao e pagamento de fatura (cardPaymentGroupId nulo) vira CardPaymentNotFoundError', async () => {
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
  const useCase = new UpdateCardPaymentUseCase(database);

  await assert.rejects(
    useCase.execute({ userId: 'u1', transactionId: 'common-1', notes: 'x' }),
    CardPaymentNotFoundError,
  );
});

test('transacao de outro usuario (ou inexistente) vira CardPaymentNotFoundError (CA-14)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u2', transactionId: 't1', notes: 'x' }),
    CardPaymentNotFoundError,
  );
  await assert.rejects(
    useCase.execute({ userId: 'u1', transactionId: 'inexistente', notes: 'x' }),
    CardPaymentNotFoundError,
  );
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: '', transactionId: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'atualizar pagamento de fatura');
      return true;
    },
  );
});
