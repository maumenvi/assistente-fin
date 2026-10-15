import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeleteInstallmentGroupUseCase } from '../../../src/app/transaction/delete.installment.group.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { TransactionNotFoundError } from '../../../src/domain/transaction/transaction.not.found.error.ts';
import { NotAnInstallmentError } from '../../../src/domain/transaction/not.an.installment.error.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';

const installment = (id: string, userId: string, date: string, number: number, groupId = 'group-1') =>
  Transaction.create({
    id,
    userId,
    date: new Date(date),
    amount: Money.fromCents(1_000),
    type: 'expense',
    categoryId: 'cat1',
    accountId: 'acc1',
    installmentGroupId: groupId,
    installmentNumber: number,
    installmentTotal: 5,
  });

const makeUseCase = () => {
  const transactions = new FakeTransactionRepository();
  const useCase = new DeleteInstallmentGroupUseCase(transactions);
  return { transactions, useCase };
};

test('grupo com parcelas passadas e futuras exclui TODAS, inclusive as vencidas', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(installment('t1', 'u1', '2026-01-15T00:00:00.000Z', 1)); // vencida
  await transactions.save(installment('t2', 'u1', '2026-02-15T00:00:00.000Z', 2)); // vencida
  await transactions.save(installment('t3', 'u1', '2026-03-20T00:00:00.000Z', 3)); // futura
  await transactions.save(installment('t4', 'u1', '2026-04-15T00:00:00.000Z', 4)); // futura
  await transactions.save(installment('t5', 'u1', '2026-05-15T00:00:00.000Z', 5)); // futura

  const result = await useCase.execute({ userId: 'u1', transactionId: 't1' });

  assert.equal(result.deletedCount, 5);
  const remaining = await transactions.listByInstallmentGroup('u1', 'group-1');
  assert.deepEqual(remaining, []);
});

test('transacao que nao e parcela vira NotAnInstallmentError', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(
    Transaction.create({
      id: 'common-1',
      userId: 'u1',
      date: new Date('2026-04-01T00:00:00.000Z'),
      amount: Money.fromCents(1_000),
      type: 'expense',
      categoryId: 'cat1',
      accountId: 'acc1',
    }),
  );

  await assert.rejects(
    useCase.execute({ userId: 'u1', transactionId: 'common-1' }),
    NotAnInstallmentError,
  );
});

test('transacao de outro usuario (ou inexistente) vira TransactionNotFoundError', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(installment('t1', 'u2', '2026-04-01T00:00:00.000Z', 1));

  await assert.rejects(
    useCase.execute({ userId: 'u1', transactionId: 't1' }),
    TransactionNotFoundError,
  );
  await assert.rejects(
    useCase.execute({ userId: 'u1', transactionId: 'inexistente' }),
    TransactionNotFoundError,
  );
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: '', transactionId: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'excluir grupo de parcelas');
      return true;
    },
  );
});
