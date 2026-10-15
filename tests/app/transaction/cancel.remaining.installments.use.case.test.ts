import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CancelRemainingInstallmentsUseCase } from '../../../src/app/transaction/cancel.remaining.installments.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { TransactionNotFoundError } from '../../../src/domain/transaction/transaction.not.found.error.ts';
import { NotAnInstallmentError } from '../../../src/domain/transaction/not.an.installment.error.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const NOW = new Date('2026-03-15T00:00:00.000Z');

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
  const useCase = new CancelRemainingInstallmentsUseCase(transactions, new FixedClock(NOW));
  return { transactions, useCase };
};

test('grupo com parcelas passadas e futuras exclui so as futuras (RF-9/CA-7)', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(installment('t1', 'u1', '2026-01-15T00:00:00.000Z', 1)); // vencida
  await transactions.save(installment('t2', 'u1', '2026-02-15T00:00:00.000Z', 2)); // vencida
  await transactions.save(installment('t3', 'u1', '2026-03-20T00:00:00.000Z', 3)); // futura
  await transactions.save(installment('t4', 'u1', '2026-04-15T00:00:00.000Z', 4)); // futura
  await transactions.save(installment('t5', 'u1', '2026-05-15T00:00:00.000Z', 5)); // futura

  const result = await useCase.execute({ userId: 'u1', transactionId: 't1' });

  assert.equal(result.cancelledCount, 3);
  const remaining = (await transactions.listByInstallmentGroup('u1', 'group-1')).map((t) => t.id);
  assert.deepEqual(remaining, ['t1', 't2']);
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

test('todas as parcelas ja vencidas -> nenhuma exclusao, cancelledCount 0', async () => {
  const { transactions, useCase } = makeUseCase();
  await transactions.save(installment('t1', 'u1', '2026-01-15T00:00:00.000Z', 1));
  await transactions.save(installment('t2', 'u1', '2026-02-15T00:00:00.000Z', 2));
  await transactions.save(installment('t3', 'u1', '2026-03-15T00:00:00.000Z', 3)); // == NOW, nao "posterior"

  const result = await useCase.execute({ userId: 'u1', transactionId: 't1' });

  assert.equal(result.cancelledCount, 0);
  assert.equal((await transactions.listByInstallmentGroup('u1', 'group-1')).length, 3);
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: '', transactionId: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'cancelar parcelas restantes');
      return true;
    },
  );
});
