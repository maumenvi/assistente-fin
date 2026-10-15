import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeleteCardPaymentUseCase } from '../../../src/app/transaction/delete.card.payment.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { CardPaymentNotFoundError } from '../../../src/domain/transaction/card.payment.not.found.error.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';

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
    cardPaymentGroupId: groupId,
  });

const makeUseCase = () => {
  const transactions = new FakeTransactionRepository();
  const useCase = new DeleteCardPaymentUseCase(transactions);
  return { transactions, useCase };
};

test('exclui as duas pontas juntas, nunca deixando uma orfa (spec 016, RF-6)', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(leg('t1', 'u1', 'expense', 'acc-pri'));
  await transactions.save(leg('t2', 'u1', 'income', 'acc-cartao'));

  const result = await useCase.execute({ userId: 'u1', transactionId: 't1' });

  assert.equal(result.deletedCount, 2);
  assert.equal(await transactions.findById('u1', 't1'), null);
  assert.equal(await transactions.findById('u1', 't2'), null);
});

test('nao afeta pagamentos de outro grupo', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(leg('t1', 'u1', 'expense', 'acc-pri', 'payment-1'));
  await transactions.save(leg('t2', 'u1', 'income', 'acc-cartao', 'payment-1'));
  await transactions.save(leg('t3', 'u1', 'expense', 'acc-pri', 'payment-2'));
  await transactions.save(leg('t4', 'u1', 'income', 'acc-cartao', 'payment-2'));

  await useCase.execute({ userId: 'u1', transactionId: 't1' });

  assert.ok(await transactions.findById('u1', 't3'));
  assert.ok(await transactions.findById('u1', 't4'));
});

test('transacao que nao e pagamento de fatura (cardPaymentGroupId nulo) vira CardPaymentNotFoundError', async () => {
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
    CardPaymentNotFoundError,
  );
});

test('transacao de outro usuario (ou inexistente) vira CardPaymentNotFoundError (CA-14)', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(leg('t1', 'u2', 'expense', 'acc-pri'));

  await assert.rejects(
    useCase.execute({ userId: 'u1', transactionId: 't1' }),
    CardPaymentNotFoundError,
  );
  await assert.rejects(
    useCase.execute({ userId: 'u1', transactionId: 'inexistente' }),
    CardPaymentNotFoundError,
  );
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: '', transactionId: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'excluir pagamento de fatura');
      return true;
    },
  );
});
