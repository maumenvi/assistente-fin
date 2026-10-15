import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ListTransactionsUseCase } from '../../../src/app/transaction/list.transaction.use.case.ts';
import { UpdateTransactionUseCase } from '../../../src/app/transaction/update.transaction.use.case.ts';
import { DeleteTransactionUseCase } from '../../../src/app/transaction/delete.transaction.use.case.ts';
import { listLaunchedIncomeMonths } from '../../../src/app/income/list.launched.income.months.ts';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { TransactionNotFoundError } from '../../../src/domain/transaction/transaction.not.found.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { AccountArchivedError } from '../../../src/domain/account/account.archived.error.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { StructuralTransactionEditNotAllowedError } from '../../../src/domain/transaction/structural.transaction.edit.not.allowed.error.ts';
import { FakeTransactionRepository } from '../../../src/database/fake/transaction.repository.fake.ts';
import { FakeAccountRepository } from '../../../src/database/fake/account.repository.fake.ts';
import { fakeCategories, DEFAULT_CATEGORY_ID } from '../../support/fake.categories.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { type Database } from '../../../src/app/shared/database.port.ts';

const tx = (id: string, userId: string, date: string, cents: number, categoryId = 'cat-mercado') =>
  Transaction.create({
    id,
    userId,
    date: new Date(date),
    amount: Money.fromCents(cents),
    type: 'expense',
    accountId: 'acc1',
    categoryId,
  });

/**
 * `Database` minimo sobre os fakes que este arquivo ja monta. `UpdateTransactionUseCase` passou
 * a receber o `Database` inteiro (spec 020, T022) para abrir `database.transaction()` e
 * propagar categoria/notas as parcelas do grupo atomicamente (RF-51b) - antes recebia os
 * repositorios soltos. O `FakeDatabase` completo nao serve aqui porque cria os proprios
 * repositorios, e os testes deste arquivo dependem das instancias que eles mesmos populam.
 */
function databaseWith(
  transactions: FakeTransactionRepository,
  categories: ReturnType<typeof fakeCategories>,
  accounts: FakeAccountRepository,
): Database {
  const db = {
    transactions,
    categories,
    accounts,
    // sem transacao real: os fakes sao sincronos e em memoria, entao `work(db)` ja da a
    // semantica de "tudo no mesmo contexto". A atomicidade de verdade e coberta pela suite
    // de contrato do adapter Prisma.
    transaction: async <T>(work: (tx: Database) => Promise<T>): Promise<T> => work(db),
  } as unknown as Database;
  return db;
}

const setup = async () => {
  const repo = new FakeTransactionRepository();
  const categories = fakeCategories('u1', { 'cat-mercado': 'Mercado' });
  const accounts = new FakeAccountRepository();
  const ids = new SequentialIdGenerator('cat');
  await repo.save(tx('t1', 'u1', '2026-01-05T10:00:00.000Z', 5_000));
  await repo.save(tx('t2', 'u1', '2026-01-10T10:00:00.000Z', 2_000));
  await repo.save(tx('t3', 'u2', '2026-01-01T10:00:00.000Z', 9_000));
  await accounts.save(
    Account.create({ id: 'acc1', userId: 'u1', name: 'Conta 1', kind: 'checking', openingBalance: Money.fromCents(0) }),
  );
  await accounts.save(
    Account.create({ id: 'acc2', userId: 'u1', name: 'Conta 2', kind: 'checking', openingBalance: Money.fromCents(0) }),
  );
  await accounts.save(
    Account.create({ id: 'acc-archived', userId: 'u1', name: 'Conta arquivada', kind: 'checking', openingBalance: Money.fromCents(0) }).archive(),
  );
  await accounts.save(
    Account.create({ id: 'acc-other-user', userId: 'u2', name: 'Conta u2', kind: 'checking', openingBalance: Money.fromCents(0) }),
  );
  return {
    repo,
    categories,
    accounts,
    list: new ListTransactionsUseCase(repo, categories),
    update: new UpdateTransactionUseCase(databaseWith(repo, categories, accounts), ids),
    del: new DeleteTransactionUseCase(repo),
  };
};

test('list filtra por usuario e vem ordenada (mais recente primeiro)', async () => {
  const { list } = await setup();
  assert.deepEqual((await list.execute({ userId: 'u1' })).map((r) => r.item.id), ['t2', 't1']);
});

test('update mescla campos e NAO dispara duplicidade contra uma transacao igual', async () => {
  const { repo, update } = await setup();
  // t2 vira igual a t1 em conta+tipo+valor+dia - update deliberado, sem checar dedup
  const updated = await update.execute({
    userId: 'u1',
    id: 't2',
    date: '2026-01-05T23:00:00.000Z',
    amountCents: 5_000,
  });
  assert.equal(updated.amount.cents, 5_000);
  assert.equal((await repo.findById('u1', 't2'))?.amount.cents, 5_000);
});

test('update sem categoria informada preserva o vinculo atual (spec 003)', async () => {
  const { update } = await setup();
  const updated = await update.execute({ userId: 'u1', id: 't1', amountCents: 4_200 });
  assert.equal(updated.categoryId, 'cat-mercado', 'categoria intacta');
  assert.equal(updated.amount.cents, 4_200);
});

test('update com categoryName nova cria a categoria e revincula (CA-9)', async () => {
  const { categories, update } = await setup();
  const updated = await update.execute({ userId: 'u1', id: 't1', categoryName: 'lazer' });
  const created = await categories.findById('u1', updated.categoryId);
  assert.equal(created?.name.value, 'LAZER');
});

test('update com expectedUpdatedAt desatualizado vira StaleDataError (RF-31)', async () => {
  const { repo, update } = await setup();
  const seenAt = (await repo.findById('u1', 't1'))!.updatedAt!.toISOString();
  await update.execute({ userId: 'u1', id: 't1', amountCents: 6_000, expectedUpdatedAt: seenAt });
  await assert.rejects(
    update.execute({ userId: 'u1', id: 't1', amountCents: 7_000, expectedUpdatedAt: seenAt }),
    StaleDataError,
  );
});

test('operacoes em transacao de outro usuario viram TransactionNotFoundError', async () => {
  const { update, del } = await setup();
  await assert.rejects(update.execute({ userId: 'u1', id: 't3', amountCents: 1 }), TransactionNotFoundError);
  await assert.rejects(del.execute({ userId: 'u1', id: 't3' }), TransactionNotFoundError);
});

test('editar uma ocorrencia a desanexa da serie e nao mexe nas demais (CA-19)', async () => {
  const { repo, update } = await setup();
  // duas ocorrencias da mesma serie
  await repo.save(
    Transaction.create({
      id: 'occ-a',
      userId: 'u1',
      date: new Date('2026-02-01T10:00:00.000Z'),
      amount: Money.fromCents(3_000),
      type: 'expense',
      accountId: 'acc1',
      categoryId: 'cat-mercado',
      seriesId: 'series-1',
    }),
  );
  await repo.save(
    Transaction.create({
      id: 'occ-b',
      userId: 'u1',
      date: new Date('2026-03-01T10:00:00.000Z'),
      amount: Money.fromCents(3_000),
      type: 'expense',
      accountId: 'acc1',
      categoryId: 'cat-mercado',
      seriesId: 'series-1',
    }),
  );

  const updated = await update.execute({ userId: 'u1', id: 'occ-a', amountCents: 9_900 });

  assert.equal(updated.amount.cents, 9_900);
  assert.equal(updated.seriesId, null, 'a ocorrencia editada saiu da serie');
  assert.equal((await repo.findById('u1', 'occ-b'))?.seriesId, 'series-1', 'a outra ficou');
  assert.equal((await repo.findById('u1', 'occ-b'))?.amount.cents, 3_000);
});

test('update com accountId para conta valida e nao arquivada troca a conta (RF-8)', async () => {
  const { repo, update } = await setup();
  const updated = await update.execute({ userId: 'u1', id: 't1', accountId: 'acc2' });
  assert.equal(updated.accountId, 'acc2');
  assert.equal((await repo.findById('u1', 't1'))?.accountId, 'acc2');
});

test('update com accountId inexistente vira AccountNotFoundError', async () => {
  const { update } = await setup();
  await assert.rejects(
    update.execute({ userId: 'u1', id: 't1', accountId: 'acc-inexistente' }),
    AccountNotFoundError,
  );
});

test('update com accountId de outro usuario vira AccountNotFoundError (isolamento)', async () => {
  const { update } = await setup();
  await assert.rejects(
    update.execute({ userId: 'u1', id: 't1', accountId: 'acc-other-user' }),
    AccountNotFoundError,
  );
});

test('update com accountId arquivada vira AccountArchivedError (CA-10)', async () => {
  const { repo, update } = await setup();
  await assert.rejects(
    update.execute({ userId: 'u1', id: 't1', accountId: 'acc-archived' }),
    AccountArchivedError,
  );
  assert.equal((await repo.findById('u1', 't1'))?.accountId, 'acc1', 'nao alterou o lancamento');
});

test('editar accountId de ocorrencia de serie a desanexa (RF-9)', async () => {
  const { repo, update } = await setup();
  await repo.save(
    Transaction.create({
      id: 'occ-c',
      userId: 'u1',
      date: new Date('2026-04-01T10:00:00.000Z'),
      amount: Money.fromCents(3_000),
      type: 'expense',
      accountId: 'acc1',
      categoryId: 'cat-mercado',
      seriesId: 'series-2',
    }),
  );

  const updated = await update.execute({ userId: 'u1', id: 'occ-c', accountId: 'acc2' });

  assert.equal(updated.accountId, 'acc2');
  assert.equal(updated.seriesId, null, 'desanexou da serie');
  assert.equal(updated.recurrence.repeats(), false, 'recorrencia resetada');
});

test('delete remove e devolve', async () => {
  const { repo, del } = await setup();
  assert.equal((await del.execute({ userId: 'u1', id: 't1' })).id, 't1');
  assert.equal(await repo.findById('u1', 't1'), null);
});

test('excluir uma Transaction lancada de um Income libera o mes de novo (spec 012, RF-10)', async () => {
  const { repo, del } = await setup();
  await repo.save(
    Transaction.create({
      id: 'tx-launch',
      userId: 'u1',
      date: new Date('2026-03-05T00:00:00.000Z'),
      amount: Money.fromCents(500_000),
      type: 'income',
      accountId: 'acc1',
      categoryId: 'cat-mercado',
      incomeId: 'income-1',
    }),
  );

  const before = listLaunchedIncomeMonths(await repo.listByUser('u1'), 'income-1');
  assert.ok(before.has('2026-03'), 'mes marcado como lancado antes de excluir');

  await del.execute({ userId: 'u1', id: 'tx-launch' });

  const after = listLaunchedIncomeMonths(await repo.listByUser('u1'), 'income-1');
  assert.ok(!after.has('2026-03'), 'mes volta a nao constar como lancado apos excluir');
});

test('editar uma parcela preserva o vinculo de grupo e nao afeta as demais (spec 009, RF-7/CA-5)', async () => {
  const { repo, update } = await setup();
  await repo.save(
    Transaction.create({
      id: 'inst-1',
      userId: 'u1',
      date: new Date('2026-05-01T10:00:00.000Z'),
      amount: Money.fromCents(1_000),
      type: 'expense',
      accountId: 'acc1',
      categoryId: 'cat-mercado',
      installmentGroupId: 'group-9',
      installmentNumber: 1,
      installmentTotal: 3,
    }),
  );
  await repo.save(
    Transaction.create({
      id: 'inst-2',
      userId: 'u1',
      date: new Date('2026-06-01T10:00:00.000Z'),
      amount: Money.fromCents(1_000),
      type: 'expense',
      accountId: 'acc1',
      categoryId: 'cat-mercado',
      installmentGroupId: 'group-9',
      installmentNumber: 2,
      installmentTotal: 3,
    }),
  );

  const updated = await update.execute({ userId: 'u1', id: 'inst-1', amountCents: 1_500, notes: 'ajuste' });

  assert.equal(updated.amount.cents, 1_500);
  assert.equal(updated.installmentGroupId, 'group-9', 'continua parcela do mesmo grupo (RF-7)');
  assert.equal(updated.installmentNumber, 1);
  assert.equal(updated.installmentTotal, 3);

  const other = await repo.findById('u1', 'inst-2');
  assert.equal(other?.amount.cents, 1_000, 'a outra parcela nao foi alterada');
  assert.equal(other?.installmentGroupId, 'group-9');
  assert.equal(other?.installmentNumber, 2);
});

test('excluir uma parcela nao afeta as demais do grupo (spec 009, RF-7/CA-6)', async () => {
  const { repo, del } = await setup();
  await repo.save(
    Transaction.create({
      id: 'inst-a',
      userId: 'u1',
      date: new Date('2026-05-01T10:00:00.000Z'),
      amount: Money.fromCents(1_000),
      type: 'expense',
      accountId: 'acc1',
      categoryId: 'cat-mercado',
      installmentGroupId: 'group-8',
      installmentNumber: 1,
      installmentTotal: 2,
    }),
  );
  await repo.save(
    Transaction.create({
      id: 'inst-b',
      userId: 'u1',
      date: new Date('2026-06-01T10:00:00.000Z'),
      amount: Money.fromCents(1_000),
      type: 'expense',
      accountId: 'acc1',
      categoryId: 'cat-mercado',
      installmentGroupId: 'group-8',
      installmentNumber: 2,
      installmentTotal: 2,
    }),
  );

  await del.execute({ userId: 'u1', id: 'inst-a' });

  assert.equal(await repo.findById('u1', 'inst-a'), null);
  const remaining = await repo.findById('u1', 'inst-b');
  assert.ok(remaining, 'a outra parcela permanece');
  assert.equal(remaining?.installmentGroupId, 'group-8');
});

test('update recusa mudar amountCents de uma perna de transferencia (achado do bug de forecast divergente)', async () => {
  const { repo, update } = await setup();
  await repo.save(
    Transaction.create({
      id: 'leg-out',
      userId: 'u1',
      date: new Date('2026-07-01T10:00:00.000Z'),
      amount: Money.fromCents(10_000),
      type: 'expense',
      accountId: 'acc1',
      categoryId: 'cat-mercado',
      transferGroupId: 'group-transfer-1',
    }),
  );

  await assert.rejects(
    update.execute({ userId: 'u1', id: 'leg-out', amountCents: 20_000 }),
    StructuralTransactionEditNotAllowedError,
  );
  // accountId/type tambem sao estruturais nessa perna
  await assert.rejects(
    update.execute({ userId: 'u1', id: 'leg-out', accountId: 'acc2' }),
    StructuralTransactionEditNotAllowedError,
  );
  await assert.rejects(
    update.execute({ userId: 'u1', id: 'leg-out', type: 'income' }),
    StructuralTransactionEditNotAllowedError,
  );
});

test('update em perna de transferencia aceita date/notes e preserva o transferGroupId', async () => {
  const { repo, update } = await setup();
  await repo.save(
    Transaction.create({
      id: 'leg-out',
      userId: 'u1',
      date: new Date('2026-07-01T10:00:00.000Z'),
      amount: Money.fromCents(10_000),
      type: 'expense',
      accountId: 'acc1',
      categoryId: 'cat-mercado',
      transferGroupId: 'group-transfer-1',
    }),
  );

  const updated = await update.execute({ userId: 'u1', id: 'leg-out', notes: 'ajuste de nota' });
  assert.equal(updated.transferGroupId, 'group-transfer-1', 'grupo preservado, nao zerado por omissao');
  assert.equal(updated.notes, 'ajuste de nota');
});

test('update recusa mudar amountCents de uma perna de pagamento de fatura', async () => {
  const { repo, update } = await setup();
  await repo.save(
    Transaction.create({
      id: 'card-leg-out',
      userId: 'u1',
      date: new Date('2026-07-05T10:00:00.000Z'),
      amount: Money.fromCents(5_000),
      type: 'expense',
      accountId: 'acc1',
      categoryId: 'cat-mercado',
      cardPaymentGroupId: 'group-card-1',
    }),
  );

  await assert.rejects(
    update.execute({ userId: 'u1', id: 'card-leg-out', amountCents: 6_000 }),
    StructuralTransactionEditNotAllowedError,
  );
});

test('update recusa mudar amountCents/date do SALDO INICIAL - use account.update (spec 018, RF-28)', async () => {
  const { repo, categories, update } = await setup();
  await categories.save(
    Category.create({
      id: 'cat-saldo-inicial',
      userId: 'u1',
      name: CategoryName.create('SALDO INICIAL'),
      isSystemOpeningBalance: true,
    }),
  );
  await repo.save(
    Transaction.create({
      id: 'opening-1',
      userId: 'u1',
      date: new Date('2026-01-01T10:00:00.000Z'),
      amount: Money.fromCents(50_000),
      type: 'income',
      accountId: 'acc1',
      categoryId: 'cat-saldo-inicial',
    }),
  );

  await assert.rejects(
    update.execute({ userId: 'u1', id: 'opening-1', amountCents: 99_999 }),
    StructuralTransactionEditNotAllowedError,
  );
  await assert.rejects(
    update.execute({ userId: 'u1', id: 'opening-1', date: '2026-02-01T00:00:00.000Z' }),
    StructuralTransactionEditNotAllowedError,
  );
  // notes continua livre - so amountCents/date sao estruturais aqui
  const updated = await update.execute({ userId: 'u1', id: 'opening-1', notes: 'nota qualquer' });
  assert.equal(updated.notes, 'nota qualquer');
  assert.equal(updated.amount.cents, 50_000, 'valor intacto');
});

// ---------------------------------------------------------------------------
// spec 020 (RF-51/51a/51b): categoria e notas sao atributos da COMPRA parcelada
// ---------------------------------------------------------------------------

/** Uma parcela do grupo `grupo-1`, com `n` de `total`. */
const parcela = (id: string, n: number, total: number, categoryId = 'cat-mercado', notes?: string) =>
  Transaction.create({
    id,
    userId: 'u1',
    date: new Date(`2026-0${n}-10T10:00:00.000Z`),
    amount: Money.fromCents(10_000),
    type: 'expense',
    accountId: 'acc1',
    categoryId,
    ...(notes !== undefined ? { notes } : {}),
    installmentGroupId: 'grupo-1',
    installmentNumber: n,
    installmentTotal: total,
  });

const setupInstallments = async () => {
  const base = await setup();
  await base.repo.save(parcela('p1', 1, 3));
  await base.repo.save(parcela('p2', 2, 3));
  await base.repo.save(parcela('p3', 3, 3));
  return base;
};

test('editar a categoria de uma parcela aplica a TODAS as parcelas do grupo (RF-51)', async () => {
  const { repo, update } = await setupInstallments();

  await update.execute({ id: 'p1', userId: 'u1', categoryName: 'Padaria' });

  const grupo = await repo.listByInstallmentGroup('u1', 'grupo-1');
  const categorias = new Set(grupo.map((p) => p.categoryId));
  assert.equal(categorias.size, 1, 'as 3 parcelas ficam na mesma categoria');
  assert.notEqual([...categorias][0], 'cat-mercado', 'e e a nova, nao a antiga');
});

test('editar as notas de uma parcela aplica a todas do grupo (RF-51)', async () => {
  const { repo, update } = await setupInstallments();

  await update.execute({ id: 'p2', userId: 'u1', notes: 'compra do mes' });

  const grupo = await repo.listByInstallmentGroup('u1', 'grupo-1');
  for (const p of grupo) {
    assert.equal(p.notes, 'compra do mes', `parcela ${p.installmentNumber}`);
  }
});

test('sobrescreve parcela ja editada a mao, sem confirmacao (RF-51a)', async () => {
  const { repo, update } = await setupInstallments();
  // a parcela 2 tinha sido posta numa categoria diferente individualmente
  await repo.save(parcela('p2', 2, 3, DEFAULT_CATEGORY_ID));

  await update.execute({ id: 'p1', userId: 'u1', categoryName: 'Padaria' });

  const grupo = await repo.listByInstallmentGroup('u1', 'grupo-1');
  const categorias = new Set(grupo.map((p) => p.categoryId));
  assert.equal(categorias.size, 1, 'a divergente tambem foi alinhada');
});

test('valor, data e conta afetam SOMENTE a parcela editada (RF-51, spec 009 RF-7)', async () => {
  const { repo, update } = await setupInstallments();

  await update.execute({
    id: 'p1',
    userId: 'u1',
    amountCents: 42_00,
    date: '2026-12-25',
    accountId: 'acc2',
  });

  const grupo = await repo.listByInstallmentGroup('u1', 'grupo-1');
  const editada = grupo.find((p) => p.id === 'p1')!;
  const irmas = grupo.filter((p) => p.id !== 'p1');

  assert.equal(editada.amount.cents, 42_00);
  assert.equal(editada.accountId, 'acc2');
  for (const irma of irmas) {
    assert.equal(irma.amount.cents, 10_000, 'valor da irma intacto');
    assert.equal(irma.accountId, 'acc1', 'conta da irma intacta');
    assert.equal(irma.date.getUTCMonth() + 1, irma.installmentNumber, 'data da irma intacta');
  }
});

test('a propagacao nunca reescreve a identidade da parcela (grupo/numero/total)', async () => {
  const { repo, update } = await setupInstallments();

  await update.execute({ id: 'p1', userId: 'u1', categoryName: 'Padaria' });

  const grupo = await repo.listByInstallmentGroup('u1', 'grupo-1');
  assert.equal(grupo.length, 3);
  for (const p of grupo) {
    assert.equal(p.installmentGroupId, 'grupo-1');
    assert.equal(p.installmentTotal, 3);
  }
  assert.deepEqual(
    grupo.map((p) => p.installmentNumber).sort(),
    [1, 2, 3],
  );
});

test('a propagacao nao alcanca parcela de outro usuario (isolamento por userId)', async () => {
  const { repo, update } = await setupInstallments();
  // mesmo installmentGroupId, outro dono - nunca deve ser tocado
  await repo.save(
    Transaction.create({
      id: 'intruso',
      userId: 'u2',
      date: new Date('2026-01-10T10:00:00.000Z'),
      amount: Money.fromCents(10_000),
      type: 'expense',
      accountId: 'acc-other-user',
      categoryId: 'cat-mercado',
      installmentGroupId: 'grupo-1',
      installmentNumber: 1,
      installmentTotal: 3,
    }),
  );

  await update.execute({ id: 'p1', userId: 'u1', categoryName: 'Padaria' });

  const doOutro = await repo.findById('u2', 'intruso');
  assert.equal(doOutro?.categoryId, 'cat-mercado', 'parcela de outro usuario intacta');
});

test('transacao que nao e parcela continua afetando so ela mesma (regressao)', async () => {
  const { repo, update } = await setupInstallments();

  await update.execute({ id: 't1', userId: 'u1', categoryName: 'Padaria' });

  const grupo = await repo.listByInstallmentGroup('u1', 'grupo-1');
  for (const p of grupo) {
    assert.equal(p.categoryId, 'cat-mercado', 'o grupo nao foi tocado por uma edicao de fora');
  }
});

test('falha no meio da propagacao aborta a operacao inteira (RF-51b)', async () => {
  const { repo, categories, accounts } = await setupInstallments();

  // Simula falha ao gravar a primeira irma. O que este teste garante e o CONTRATO do caso de
  // uso: a propagacao acontece dentro de `database.transaction()`, entao qualquer falha sobe
  // e aborta tudo - o caso de uso nunca engole o erro nem segue gravando as demais.
  // O rollback em si e responsabilidade do adapter (Prisma $transaction), coberto pela suite
  // de contrato do banco; aqui o fake nao desfaz escritas, entao nao da pra afirmar rollback.
  const failing = {
    transactions: {
      ...repo,
      findById: repo.findById.bind(repo),
      listByInstallmentGroup: repo.listByInstallmentGroup.bind(repo),
      save: async (t: Transaction) => {
        if (t.id !== 'p1') throw new Error('falha simulada no meio da propagacao');
        return repo.save(t);
      },
    },
    categories,
    accounts,
    transaction: async <T>(work: (tx: Database) => Promise<T>): Promise<T> =>
      work(failing as unknown as Database),
  };
  const update = new UpdateTransactionUseCase(
    failing as unknown as Database,
    new SequentialIdGenerator('cat'),
  );

  await assert.rejects(
    () => update.execute({ id: 'p1', userId: 'u1', categoryName: 'Padaria' }),
    /falha simulada/,
    'o erro sobe para a borda em vez de ser engolido',
  );

  // a terceira parcela nunca chegou a ser gravada: a operacao parou na primeira falha
  const p3 = await repo.findById('u1', 'p3');
  assert.equal(p3?.categoryId, 'cat-mercado');
});
