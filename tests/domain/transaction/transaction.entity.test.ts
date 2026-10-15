import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { InvalidTransactionError } from '../../../src/domain/transaction/invalid.transaction.error.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';

const base = () => ({
  id: 'tx-1',
  userId: 'user-1',
  date: new Date('2026-01-05T00:00:00.000Z'),
  amount: Money.fromCents(5_000),
  type: 'expense' as const,
  categoryId: 'cat-1',
  accountId: 'acc-1',
});

test('create exige categoryId - nao ha mais transacao sem categoria (spec 003, RF-10)', () => {
  const transaction = Transaction.create(base());

  assert.equal(transaction.categoryId, 'cat-1');
  // "pendente de classificacao" deixou de ser estado da entidade: agora e o vinculo com a
  // categoria padrao, e so o app sabe qual e (CA-7, RF-14)
  assert.equal('isPendingClassification' in transaction, false);
  assert.throws(() => Transaction.create({ ...base(), categoryId: '  ' }), /categoryId/);
});

test('create normaliza o categoryId com trim', () => {
  const transaction = Transaction.create({ ...base(), categoryId: '  cat-9  ' });

  assert.equal(transaction.categoryId, 'cat-9');
});

test('create rejeita campos invalidos', () => {
  assert.throws(() => Transaction.create({ ...base(), id: '' }), InvalidTransactionError);
  assert.throws(() => Transaction.create({ ...base(), date: new Date('invalido') }), InvalidTransactionError);
  assert.throws(
    () => Transaction.create({ ...base(), amount: Money.zero() }),
    InvalidTransactionError,
  );
  assert.throws(
    () => Transaction.create({ ...base(), amount: Money.fromCents(-100) }),
    InvalidTransactionError,
  );
  assert.throws(
    // @ts-expect-error type invalido de proposito
    () => Transaction.create({ ...base(), type: 'transfer' }),
    InvalidTransactionError,
  );
  assert.throws(() => Transaction.create({ ...base(), categoryId: '   ' }), InvalidTransactionError);
  assert.throws(() => Transaction.create({ ...base(), accountId: '' }), InvalidTransactionError);
});

test('a entidade nao expoe mais classify - trocar categoria e reconstruir (spec 003, RF-13)', () => {
  const transaction = Transaction.create(base()) as unknown as Record<string, unknown>;

  assert.equal(transaction['classify'], undefined);
  assert.equal(transaction['isPendingClassification'], undefined);
});

test('fromPersistence reaplica as mesmas invariantes de create (defesa em profundidade)', () => {
  const transaction = Transaction.fromPersistence(base());
  assert.equal(transaction.categoryId, 'cat-1');

  assert.throws(() => Transaction.fromPersistence({ ...base(), id: '' }), InvalidTransactionError);
  assert.throws(
    () => Transaction.fromPersistence({ ...base(), categoryId: '' }),
    InvalidTransactionError,
  );
});

test('recorrencia e seriesId ausentes -> nao-repete e null (spec 003, RF-16/RF-26)', () => {
  const transaction = Transaction.create(base());
  assert.equal(transaction.recurrence.frequency, 'nao-repete');
  assert.equal(transaction.seriesId, null);
});

test('fromPersistence preserva a recorrencia e o seriesId', () => {
  const recurrence = Recurrence.create({
    frequency: 'mensal',
    endDate: new Date('2026-08-31T00:00:00.000Z'),
  });
  const transaction = Transaction.fromPersistence({ ...base(), recurrence, seriesId: 'series-9' });

  assert.equal(transaction.recurrence.frequency, 'mensal');
  assert.equal(transaction.seriesId, 'series-9');
  assert.equal(transaction.withUpdatedAt(new Date()).seriesId, 'series-9', 'withUpdatedAt preserva');
});

test('seriesId vazio (so espacos) e rejeitado', () => {
  assert.throws(() => Transaction.create({ ...base(), seriesId: '   ' }), InvalidTransactionError);
});

test('incomeId ausente -> null (spec 012, Q2)', () => {
  const transaction = Transaction.create(base());
  assert.equal(transaction.incomeId, null);
});

test('incomeId aceita null explicito e string valida (trim)', () => {
  assert.equal(Transaction.create({ ...base(), incomeId: null }).incomeId, null);
  assert.equal(
    Transaction.create({ ...base(), incomeId: '  income-1  ' }).incomeId,
    'income-1',
  );
});

test('incomeId vazio (so espacos) e rejeitado', () => {
  assert.throws(() => Transaction.create({ ...base(), incomeId: '   ' }), InvalidTransactionError);
});

test('fromPersistence preserva o incomeId; withUpdatedAt preserva', () => {
  const transaction = Transaction.fromPersistence({ ...base(), incomeId: 'income-9' });
  assert.equal(transaction.incomeId, 'income-9');
  assert.equal(transaction.withUpdatedAt(new Date()).incomeId, 'income-9', 'withUpdatedAt preserva');
});

test('transferGroupId ausente -> null (spec 016, RF-5)', () => {
  const transaction = Transaction.create(base());
  assert.equal(transaction.transferGroupId, null);
});

test('transferGroupId aceita null explicito e string valida (trim)', () => {
  assert.equal(Transaction.create({ ...base(), transferGroupId: null }).transferGroupId, null);
  assert.equal(
    Transaction.create({ ...base(), transferGroupId: '  transfer-1  ' }).transferGroupId,
    'transfer-1',
  );
});

test('transferGroupId vazio (so espacos) e rejeitado', () => {
  assert.throws(
    () => Transaction.create({ ...base(), transferGroupId: '   ' }),
    InvalidTransactionError,
  );
});

test('fromPersistence preserva o transferGroupId; withUpdatedAt preserva', () => {
  const transaction = Transaction.fromPersistence({ ...base(), transferGroupId: 'transfer-9' });
  assert.equal(transaction.transferGroupId, 'transfer-9');
  assert.equal(
    transaction.withUpdatedAt(new Date()).transferGroupId,
    'transfer-9',
    'withUpdatedAt preserva',
  );
});

test('cardPaymentGroupId ausente -> null (spec 016, RF-6)', () => {
  const transaction = Transaction.create(base());
  assert.equal(transaction.cardPaymentGroupId, null);
});

test('cardPaymentGroupId aceita null explicito e string valida (trim)', () => {
  assert.equal(
    Transaction.create({ ...base(), cardPaymentGroupId: null }).cardPaymentGroupId,
    null,
  );
  assert.equal(
    Transaction.create({ ...base(), cardPaymentGroupId: '  payment-1  ' }).cardPaymentGroupId,
    'payment-1',
  );
});

test('cardPaymentGroupId vazio (so espacos) e rejeitado', () => {
  assert.throws(
    () => Transaction.create({ ...base(), cardPaymentGroupId: '   ' }),
    InvalidTransactionError,
  );
});

test('fromPersistence preserva o cardPaymentGroupId; withUpdatedAt preserva', () => {
  const transaction = Transaction.fromPersistence({
    ...base(),
    cardPaymentGroupId: 'payment-9',
  });
  assert.equal(transaction.cardPaymentGroupId, 'payment-9');
  assert.equal(
    transaction.withUpdatedAt(new Date()).cardPaymentGroupId,
    'payment-9',
    'withUpdatedAt preserva',
  );
});

test('campos de parcela ausentes -> isInstallment() falso (spec 009, RF-4)', () => {
  const transaction = Transaction.create(base());
  assert.equal(transaction.isInstallment(), false);
  assert.equal(transaction.installmentGroupId, null);
  assert.equal(transaction.installmentNumber, null);
  assert.equal(transaction.installmentTotal, null);
});

test('campos de parcela consistentes e preenchidos sao aceitos (spec 009, RF-4)', () => {
  const transaction = Transaction.create({
    ...base(),
    installmentGroupId: 'group-1',
    installmentNumber: 3,
    installmentTotal: 12,
  });

  assert.equal(transaction.isInstallment(), true);
  assert.equal(transaction.installmentGroupId, 'group-1');
  assert.equal(transaction.installmentNumber, 3);
  assert.equal(transaction.installmentTotal, 12);
});

test('so um dos tres campos de parcela preenchido e rejeitado (spec 009)', () => {
  assert.throws(
    () => Transaction.create({ ...base(), installmentNumber: 1 }),
    InvalidTransactionError,
  );
  assert.throws(
    () => Transaction.create({ ...base(), installmentGroupId: 'group-1' }),
    InvalidTransactionError,
  );
  assert.throws(
    () => Transaction.create({ ...base(), installmentTotal: 12 }),
    InvalidTransactionError,
  );
  assert.throws(
    () =>
      Transaction.create({
        ...base(),
        installmentGroupId: 'group-1',
        installmentNumber: 3,
      }),
    InvalidTransactionError,
  );
});

test('installmentNumber maior que installmentTotal e rejeitado (spec 009)', () => {
  assert.throws(
    () =>
      Transaction.create({
        ...base(),
        installmentGroupId: 'group-1',
        installmentNumber: 13,
        installmentTotal: 12,
      }),
    InvalidTransactionError,
  );
});

test('installmentTotal menor que 2 e rejeitado (spec 009, RF-10/CA-9)', () => {
  assert.throws(
    () =>
      Transaction.create({
        ...base(),
        installmentGroupId: 'group-1',
        installmentNumber: 1,
        installmentTotal: 1,
      }),
    InvalidTransactionError,
  );
});

test('fromPersistence preserva os campos de parcela', () => {
  const transaction = Transaction.fromPersistence({
    ...base(),
    installmentGroupId: 'group-9',
    installmentNumber: 2,
    installmentTotal: 5,
  });

  assert.equal(transaction.installmentGroupId, 'group-9');
  assert.equal(transaction.installmentNumber, 2);
  assert.equal(transaction.installmentTotal, 5);
  assert.equal(transaction.withUpdatedAt(new Date()).installmentGroupId, 'group-9', 'withUpdatedAt preserva');
});

test('createAdjustment aceita amount negativo, unica excecao a regra de amount positivo (spec 015)', () => {
  const transaction = Transaction.createAdjustment({ ...base(), amount: Money.fromCents(-6_000) });

  assert.equal(transaction.amount.cents, -6_000);
  assert.equal(transaction.type, 'expense');
});

test('createAdjustment continua rejeitando amount zero (spec 015)', () => {
  assert.throws(
    () => Transaction.createAdjustment({ ...base(), amount: Money.zero() }),
    InvalidTransactionError,
  );
});

test('createAdjustment aceita amount positivo normalmente', () => {
  const transaction = Transaction.createAdjustment({ ...base(), amount: Money.fromCents(4_000) });
  assert.equal(transaction.amount.cents, 4_000);
});

test('create (nao-ajuste) continua rejeitando amount negativo (regra geral RF-5 intacta)', () => {
  assert.throws(
    () => Transaction.create({ ...base(), amount: Money.fromCents(-1) }),
    InvalidTransactionError,
  );
});

test('fromPersistence releitura preserva amount negativo (transacao de ajuste ja gravada)', () => {
  const transaction = Transaction.fromPersistence({ ...base(), amount: Money.fromCents(-2_500) });
  assert.equal(transaction.amount.cents, -2_500);
});
