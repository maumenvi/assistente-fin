import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { type TransactionRepository } from '../../../src/app/transaction/transaction.repository.port.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';

const transaction = (
  id: string,
  userId: string,
  date: string,
  amountCents: number,
): Transaction =>
  Transaction.create({
    id,
    userId,
    date: new Date(date),
    amount: Money.fromCents(amountCents),
    type: 'expense',
    categoryId: 'cat1',
    accountId: 'acc1',
  });

/**
 * Suite de contrato do `TransactionRepository`.
 *
 * Reutilizavel: cada adaptador (fake hoje, Prisma tambem) chama esta funcao com uma fabrica
 * que devolve um repositorio limpo. Garante o mesmo comportamento observavel em qualquer
 * banco (CA-19, CA-20). Assume uma conta `acc1` ja existente (FK no adaptador Prisma).
 */
export function runTransactionRepositoryContract(
  label: string,
  createRepository: () => TransactionRepository,
): void {
  test(`${label}: save + findById dentro do escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(transaction('t1', 'u1', '2026-01-05T10:00:00.000Z', 5_000));

    const found = await repo.findById('u1', 't1');
    assert.equal(found?.amount.cents, 5_000);
    assert.equal(await repo.findById('u1', 'inexistente'), null);
  });

  test(`${label}: findById nao vaza transacao de outro usuario (CA-14)`, async () => {
    const repo = createRepository();
    await repo.save(transaction('t1', 'u1', '2026-01-05T10:00:00.000Z', 5_000));

    assert.equal(await repo.findById('u2', 't1'), null);
  });

  test(`${label}: save sobrescreve pelo id (ex.: trocar a categoria)`, async () => {
    const repo = createRepository();
    const original = transaction('t1', 'u1', '2026-01-05T10:00:00.000Z', 5_000);
    await repo.save(original);
    const reclassified = await repo.findById('u1', 't1');
    assert.ok(reclassified);
    await repo.save(
      Transaction.fromPersistence({
        id: reclassified.id,
        userId: reclassified.userId,
        date: reclassified.date,
        amount: reclassified.amount,
        type: reclassified.type,
        categoryId: 'cat1b',
        accountId: reclassified.accountId,
        updatedAt: reclassified.updatedAt,
      }),
    );

    const found = await repo.findById('u1', 't1');
    assert.equal(found?.categoryId, 'cat1b');
  });

  test(`${label}: listByUser filtra por usuario e ordena por data (mais recente primeiro)`, async () => {
    const repo = createRepository();
    await repo.save(transaction('t1', 'u1', '2026-01-01T00:00:00.000Z', 1_000));
    await repo.save(transaction('t2', 'u1', '2026-01-10T00:00:00.000Z', 2_000));
    await repo.save(transaction('t3', 'u2', '2026-01-15T00:00:00.000Z', 3_000));

    const amounts = (await repo.listByUser('u1')).map((t) => t.amount.cents);
    assert.deepEqual(amounts, [2_000, 1_000]);
  });

  test(`${label}: delete respeita o escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(transaction('t1', 'u1', '2026-01-05T10:00:00.000Z', 5_000));

    await repo.delete('u2', 't1');
    assert.ok(await repo.findById('u1', 't1'), 'nao remove transacao de outro usuario');

    await repo.delete('u1', 't1');
    assert.equal(await repo.findById('u1', 't1'), null);
    await repo.delete('u1', 't1'); // idempotente, nao lanca
  });

  test(`${label}: findDuplicate acha mesma conta+tipo+valor+dia (CA-5)`, async () => {
    const repo = createRepository();
    await repo.save(transaction('t1', 'u1', '2026-01-05T08:00:00.000Z', 5_000));

    const found = await repo.findDuplicate(
      transaction('t2', 'u1', '2026-01-05T23:00:00.000Z', 5_000),
    );
    assert.equal(found?.id, 't1');
  });

  test(`${label}: findDuplicate nao acha se valor, conta, tipo ou dia diferem`, async () => {
    const repo = createRepository();
    await repo.save(transaction('t1', 'u1', '2026-01-05T08:00:00.000Z', 5_000));

    assert.equal(
      await repo.findDuplicate(transaction('t2', 'u1', '2026-01-05T08:00:00.000Z', 5_001)),
      null,
      'valor diferente',
    );
    assert.equal(
      await repo.findDuplicate(transaction('t2', 'u1', '2026-01-06T08:00:00.000Z', 5_000)),
      null,
      'dia diferente',
    );
    assert.equal(
      await repo.findDuplicate(transaction('t2', 'u2', '2026-01-05T08:00:00.000Z', 5_000)),
      null,
      'usuario diferente',
    );
  });

  test(`${label}: listExpensesByAccountAndDateRange filtra conta, tipo despesa, intervalo e usuario (spec 008, RF-5)`, async () => {
    const repo = createRepository();
    await repo.save(transaction('t1', 'u1', '2026-01-15T10:00:00.000Z', 5_000)); // dentro do periodo
    await repo.save(
      Transaction.create({
        id: 't2',
        userId: 'u1',
        date: new Date('2026-01-20T10:00:00.000Z'),
        amount: Money.fromCents(1_000),
        type: 'income', // tipo errado - nao deve entrar
        categoryId: 'cat1',
        accountId: 'acc1',
      }),
    );
    await repo.save(transaction('t3', 'u1', '2025-12-31T10:00:00.000Z', 2_000)); // antes do periodo
    await repo.save(transaction('t4', 'u1', '2026-02-01T10:00:00.000Z', 3_000)); // depois do periodo
    await repo.save(
      Transaction.create({
        id: 't5',
        userId: 'u1',
        date: new Date('2026-01-10T10:00:00.000Z'),
        amount: Money.fromCents(7_000),
        type: 'expense',
        categoryId: 'cat1',
        accountId: 'acc2', // outra conta - nao deve entrar
      }),
    );
    await repo.save(transaction('t6', 'u2', '2026-01-15T10:00:00.000Z', 9_000)); // outro usuario

    const results = await repo.listExpensesByAccountAndDateRange(
      'u1',
      'acc1',
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-31T00:00:00.000Z'),
    );

    assert.deepEqual(
      results.map((t) => t.id).sort(),
      ['t1'],
    );
  });

  test(`${label}: listByInstallmentGroup devolve as parcelas do grupo, isolado por usuario (spec 009, RF-4/RF-8)`, async () => {
    const repo = createRepository();
    const installment = (id: string, userId: string, date: string, number: number) =>
      Transaction.create({
        id,
        userId,
        date: new Date(date),
        amount: Money.fromCents(1_000),
        type: 'expense',
        categoryId: 'cat1',
        accountId: 'acc1',
        installmentGroupId: 'group-1',
        installmentNumber: number,
        installmentTotal: 3,
      });
    await repo.save(installment('t1', 'u1', '2026-01-05T00:00:00.000Z', 1));
    await repo.save(installment('t2', 'u1', '2026-02-05T00:00:00.000Z', 2));
    await repo.save(installment('t3', 'u1', '2026-03-05T00:00:00.000Z', 3));
    // parcela de outro grupo e transacao comum nao devem aparecer
    await repo.save(
      Transaction.create({
        id: 't4',
        userId: 'u1',
        date: new Date('2026-01-06T00:00:00.000Z'),
        amount: Money.fromCents(1_000),
        type: 'expense',
        categoryId: 'cat1',
        accountId: 'acc1',
        installmentGroupId: 'group-2',
        installmentNumber: 1,
        installmentTotal: 2,
      }),
    );
    await repo.save(transaction('t5', 'u1', '2026-01-07T00:00:00.000Z', 500));
    // mesmo grupo, mas de outro usuario - nao deve vazar (CA-14)
    await repo.save(installment('t6', 'u2', '2026-01-05T00:00:00.000Z', 1));

    const results = await repo.listByInstallmentGroup('u1', 'group-1');
    assert.deepEqual(
      results.map((t) => t.id),
      ['t1', 't2', 't3'],
    );
    assert.ok(results.every((t) => t.installmentGroupId === 'group-1'));
  });

  test(`${label}: save rejeita gravar sobre uma versao ja alterada (RF-31)`, async () => {
    const repo = createRepository();
    await repo.save(transaction('t1', 'u1', '2026-01-05T10:00:00.000Z', 5_000));
    const v1 = await repo.findById('u1', 't1');
    const v2 = await repo.findById('u1', 't1');
    assert.ok(v1 && v2);
    await repo.save(v1);
    await assert.rejects(repo.save(v2), StaleDataError);
  });

  test(`${label}: round-trip de incomeId (spec 012, Q2)`, async () => {
    const repo = createRepository();
    await repo.save(
      Transaction.create({
        id: 't1',
        userId: 'u1',
        date: new Date('2026-01-05T10:00:00.000Z'),
        amount: Money.fromCents(5_000),
        type: 'income',
        categoryId: 'cat1',
        accountId: 'acc1',
        incomeId: 'income-1',
      }),
    );

    const found = await repo.findById('u1', 't1');
    assert.equal(found?.incomeId, 'income-1');
  });

  test(`${label}: incomeId default para null quando ausente`, async () => {
    const repo = createRepository();
    await repo.save(transaction('t1', 'u1', '2026-01-05T10:00:00.000Z', 5_000));

    const found = await repo.findById('u1', 't1');
    assert.equal(found?.incomeId, null);
  });

  test(`${label}: listByTransferGroup devolve as duas pontas do grupo, isolado por usuario (spec 016, RF-5)`, async () => {
    const repo = createRepository();
    await repo.save(
      Transaction.create({
        id: 't1',
        userId: 'u1',
        date: new Date('2026-01-05T00:00:00.000Z'),
        amount: Money.fromCents(60_000),
        type: 'expense',
        categoryId: 'cat1',
        accountId: 'acc1',
        transferGroupId: 'transfer-1',
      }),
    );
    await repo.save(
      Transaction.create({
        id: 't2',
        userId: 'u1',
        date: new Date('2026-01-05T00:00:00.000Z'),
        amount: Money.fromCents(60_000),
        type: 'income',
        categoryId: 'cat1',
        accountId: 'acc2',
        transferGroupId: 'transfer-1',
      }),
    );
    // outro grupo, transacao comum e mesmo grupo de outro usuario - nenhum deve vazar (CA-14)
    await repo.save(
      Transaction.create({
        id: 't3',
        userId: 'u1',
        date: new Date('2026-01-06T00:00:00.000Z'),
        amount: Money.fromCents(1_000),
        type: 'expense',
        categoryId: 'cat1',
        accountId: 'acc1',
        transferGroupId: 'transfer-2',
      }),
    );
    await repo.save(transaction('t4', 'u1', '2026-01-07T00:00:00.000Z', 500));
    await repo.save(
      Transaction.create({
        id: 't5',
        userId: 'u2',
        date: new Date('2026-01-05T00:00:00.000Z'),
        amount: Money.fromCents(60_000),
        type: 'expense',
        categoryId: 'cat1',
        accountId: 'acc1',
        transferGroupId: 'transfer-1',
      }),
    );

    const results = await repo.listByTransferGroup('u1', 'transfer-1');
    assert.deepEqual(
      results.map((t) => t.id),
      ['t1', 't2'],
    );
    assert.ok(results.every((t) => t.transferGroupId === 'transfer-1'));
  });

  test(`${label}: listByTransferGroup vazio quando o grupo nao existe/nao pertence ao usuario`, async () => {
    const repo = createRepository();
    assert.deepEqual(await repo.listByTransferGroup('u1', 'inexistente'), []);
  });

  test(`${label}: listByCardPaymentGroup devolve as duas pontas do grupo, isolado por usuario (spec 016, RF-6)`, async () => {
    const repo = createRepository();
    await repo.save(
      Transaction.create({
        id: 't1',
        userId: 'u1',
        date: new Date('2026-01-05T00:00:00.000Z'),
        amount: Money.fromCents(249_788),
        type: 'expense',
        categoryId: 'cat1',
        accountId: 'acc1',
        cardPaymentGroupId: 'payment-1',
      }),
    );
    await repo.save(
      Transaction.create({
        id: 't2',
        userId: 'u1',
        date: new Date('2026-01-05T00:00:00.000Z'),
        amount: Money.fromCents(249_788),
        type: 'income',
        categoryId: 'cat1',
        accountId: 'acc2',
        cardPaymentGroupId: 'payment-1',
      }),
    );
    await repo.save(
      Transaction.create({
        id: 't3',
        userId: 'u2',
        date: new Date('2026-01-05T00:00:00.000Z'),
        amount: Money.fromCents(249_788),
        type: 'expense',
        categoryId: 'cat1',
        accountId: 'acc1',
        cardPaymentGroupId: 'payment-1',
      }),
    );

    const results = await repo.listByCardPaymentGroup('u1', 'payment-1');
    assert.deepEqual(
      results.map((t) => t.id),
      ['t1', 't2'],
    );
    assert.ok(results.every((t) => t.cardPaymentGroupId === 'payment-1'));
  });

  test(`${label}: listByCardPaymentGroup vazio quando o grupo nao existe/nao pertence ao usuario`, async () => {
    const repo = createRepository();
    assert.deepEqual(await repo.listByCardPaymentGroup('u1', 'inexistente'), []);
  });

  test(`${label}: findOpeningBalanceTransaction acha a transacao pela conta+categoria (spec 018, RF-28)`, async () => {
    const repo = createRepository();
    await repo.save(
      Transaction.create({
        id: 't-saldo-inicial',
        userId: 'u1',
        date: new Date('2026-01-01T00:00:00.000Z'),
        amount: Money.fromCents(200_000),
        type: 'income',
        categoryId: 'cat1',
        accountId: 'acc1',
      }),
    );
    // outra transacao, mesma conta mas categoria diferente - nao deve ser confundida
    await repo.save(
      Transaction.create({
        id: 't-outra',
        userId: 'u1',
        date: new Date('2026-01-05T00:00:00.000Z'),
        amount: Money.fromCents(5_000),
        type: 'expense',
        categoryId: 'cat1b',
        accountId: 'acc1',
      }),
    );

    const found = await repo.findOpeningBalanceTransaction('u1', 'acc1', 'cat1');
    assert.equal(found?.id, 't-saldo-inicial');
    assert.equal(found?.amount.cents, 200_000);
  });

  test(`${label}: findOpeningBalanceTransaction devolve null quando nao existe`, async () => {
    const repo = createRepository();
    assert.equal(await repo.findOpeningBalanceTransaction('u1', 'acc1', 'cat1'), null);
  });

  test(`${label}: findOpeningBalanceTransaction isolado por usuario e conta (CA-14)`, async () => {
    const repo = createRepository();
    await repo.save(
      Transaction.create({
        id: 't-saldo-u1',
        userId: 'u1',
        date: new Date('2026-01-01T00:00:00.000Z'),
        amount: Money.fromCents(200_000),
        type: 'income',
        categoryId: 'cat1',
        accountId: 'acc1',
      }),
    );
    await repo.save(
      Transaction.create({
        id: 't-saldo-acc2',
        userId: 'u1',
        date: new Date('2026-01-01T00:00:00.000Z'),
        amount: Money.fromCents(100_000),
        type: 'income',
        categoryId: 'cat1',
        accountId: 'acc2',
      }),
    );
    await repo.save(
      Transaction.create({
        id: 't-saldo-u2',
        userId: 'u2',
        date: new Date('2026-01-01T00:00:00.000Z'),
        amount: Money.fromCents(300_000),
        type: 'income',
        categoryId: 'cat2',
        accountId: 'acc1',
      }),
    );

    // acc1/u1 acha so a sua, nao vaza a de acc2 nem a de u2 na mesma conta
    const found = await repo.findOpeningBalanceTransaction('u1', 'acc1', 'cat1');
    assert.equal(found?.id, 't-saldo-u1');
  });
}
