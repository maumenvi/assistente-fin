import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ListFixedExpensesUseCase } from '../../../src/app/fixed-expense/list.fixed.expense.use.case.ts';
import { UpdateFixedExpenseUseCase } from '../../../src/app/fixed-expense/update.fixed.expense.use.case.ts';
import { DeleteFixedExpenseUseCase } from '../../../src/app/fixed-expense/delete.fixed.expense.use.case.ts';
import { SetFixedExpensePaidUseCase } from '../../../src/app/fixed-expense/set.fixed.expense.paid.use.case.ts';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { FixedExpenseNotFoundError } from '../../../src/domain/fixed-expense/fixed.expense.not.found.error.ts';
import { FixedExpense } from '../../../src/domain/fixed-expense/fixed.expense.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { fakeCategories, DEFAULT_CATEGORY_ID } from '../../support/fake.categories.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const fe = (id: string, userId: string) =>
  FixedExpense.create({
    id,
    userId,
    dueDay: 10,
    expectedAmount: Money.fromCents(150_00),
    categoryId: 'cat-aluguel',
    accountId: 'acc1',
  });

/**
 * Uma `Transaction` vinculada ao gasto fixo `f1`, como as que ficaram no banco das marcacoes
 * de "pago" feitas ANTES da spec 021. O app nao cria mais transacoes assim (RF-58), entao os
 * testes que precisam desse historico o semeiam explicitamente.
 */
const legacyLinkedTransaction = () =>
  Transaction.create({
    id: 'tx-legado',
    userId: 'u1',
    date: new Date('2026-09-16T12:00:00.000Z'),
    amount: Money.fromCents(150_00),
    type: 'expense',
    categoryId: 'cat-aluguel',
    accountId: 'acc1',
    fixedExpenseId: 'f1',
  });

const setup = async () => {
  const database = new FakeDatabase();
  const repo = database.fixedExpenses;
  const categories = fakeCategories('u1', { 'cat-aluguel': 'Aluguel' });
  const ids = new SequentialIdGenerator('cat');
  await repo.save(fe('f1', 'u1'));
  await repo.save(fe('f2', 'u2'));
  await database.accounts.save(
    Account.create({ id: 'acc1', userId: 'u1', name: 'Carteira', kind: 'wallet', openingBalance: Money.zero() }),
  );
  await database.accounts.save(
    Account.create({ id: 'acc2', userId: 'u1', name: 'Nubank', kind: 'checking', openingBalance: Money.zero() }),
  );
  return {
    repo,
    transactions: database.transactions,
    categories,
    accounts: database.accounts,
    list: new ListFixedExpensesUseCase(repo, categories),
    update: new UpdateFixedExpenseUseCase(repo, database.accounts, categories, ids),
    del: new DeleteFixedExpenseUseCase(database),
    setPaid: new SetFixedExpensePaidUseCase(database),
  };
};

test('list filtra por usuario', async () => {
  const { list } = await setup();
  assert.deepEqual((await list.execute({ userId: 'u1' })).map((r) => r.item.id), ['f1']);
});

test('update mescla campos e preserva paid', async () => {
  const { repo, update, setPaid } = await setup();
  await setPaid.execute({ userId: 'u1', id: 'f1', paid: true });

  const updated = await update.execute({
    userId: 'u1',
    id: 'f1',
    dueDay: 5,
    categoryName: 'Aluguel Novo',
  });
  assert.equal(updated.dueDay, 5);
  assert.notEqual(updated.categoryId, 'cat-aluguel', 'nome novo -> categoria nova (CA-9)');
  assert.equal(updated.expectedAmount.cents, 150_00, 'preservado');
  assert.equal(updated.paid, true, 'paid preservado');
  assert.equal((await repo.findById('u1', 'f1'))?.dueDay, 5);
});

test('update move o gasto fixo pra outra conta do mesmo usuario quando accountId e informado', async () => {
  const { repo, update } = await setup();

  const updated = await update.execute({ userId: 'u1', id: 'f1', accountId: 'acc2' });

  assert.equal(updated.accountId, 'acc2');
  assert.equal((await repo.findById('u1', 'f1'))?.accountId, 'acc2');
});

test('update com accountId inexistente ou de outro usuario vira AccountNotFoundError', async () => {
  const { update } = await setup();

  await assert.rejects(
    update.execute({ userId: 'u1', id: 'f1', accountId: 'inexistente' }),
    AccountNotFoundError,
  );
  await assert.rejects(
    update.execute({ userId: 'u1', id: 'f1', accountId: 'acc-de-outro-usuario' }),
    AccountNotFoundError,
  );
});

test('update sem accountId mantem a conta original', async () => {
  const { repo, update } = await setup();

  const updated = await update.execute({ userId: 'u1', id: 'f1', dueDay: 20 });

  assert.equal(updated.accountId, 'acc1');
  assert.equal((await repo.findById('u1', 'f1'))?.accountId, 'acc1');
});

test('setPaid marca e desmarca (idempotente)', async () => {
  const { repo, setPaid } = await setup();
  await setPaid.execute({ userId: 'u1', id: 'f1', paid: true });
  assert.equal((await repo.findById('u1', 'f1'))?.paid, true);
  await setPaid.execute({ userId: 'u1', id: 'f1', paid: false });
  assert.equal((await repo.findById('u1', 'f1'))?.paid, false);
});

test('setPaid(true) NAO cria Transaction (spec 021, RF-58)', async () => {
  const { transactions, setPaid } = await setup();

  await setPaid.execute({ userId: 'u1', id: 'f1', paid: true });

  // ate a spec 015 isso criava uma Transaction vinculada, que era o que fazia o gasto fixo
  // contar nos totais. Desde a 021 o gasto fixo conta por si (RF-57) e "pago" e so controle.
  assert.equal(await transactions.findByFixedExpenseId('u1', 'f1'), null);
  assert.equal((await transactions.listByUser('u1')).length, 0);
});

test('setPaid(false) NAO apaga Transaction vinculada preexistente (spec 021, RF-58/RF-60)', async () => {
  const { transactions, setPaid } = await setup();
  // historico: uma marcacao feita ANTES da spec 021 deixou esta transacao no banco
  await transactions.save(legacyLinkedTransaction());

  await setPaid.execute({ userId: 'u1', id: 'f1', paid: false });

  const linked = await transactions.findByFixedExpenseId('u1', 'f1');
  assert.ok(linked, 'o historico do usuario nao e destruido; so deixa de contar como gasto');
});

test('setPaid preserva a trava otimista (spec 021 nao afrouxou o RF-31)', async () => {
  const { setPaid } = await setup();
  await setPaid.execute({ userId: 'u1', id: 'f1', paid: true });

  await assert.rejects(
    setPaid.execute({
      userId: 'u1',
      id: 'f1',
      paid: false,
      expectedUpdatedAt: new Date('2020-01-01T00:00:00.000Z').toISOString(),
    }),
    StaleDataError,
  );
});

test('marcar e desmarcar nao mexe em Transaction nenhuma (spec 021, RF-58)', async () => {
  const { transactions, setPaid } = await setup();

  await setPaid.execute({ userId: 'u1', id: 'f1', paid: true });
  await setPaid.execute({ userId: 'u1', id: 'f1', paid: false });
  await setPaid.execute({ userId: 'u1', id: 'f1', paid: true });

  assert.equal((await transactions.listByUser('u1')).length, 0);
});

test('setPaid(false) sem transacao vinculada e um no-op silencioso', async () => {
  const { transactions, setPaid } = await setup();

  const result = await setPaid.execute({ userId: 'u1', id: 'f1', paid: false });

  assert.equal(result.paid, false);
  assert.equal(await transactions.findByFixedExpenseId('u1', 'f1'), null);
});

test('update com expectedUpdatedAt desatualizado vira StaleDataError (RF-31)', async () => {
  const { repo, update } = await setup();
  const seenAt = (await repo.findById('u1', 'f1'))!.updatedAt!.toISOString();
  await update.execute({ userId: 'u1', id: 'f1', dueDay: 6, expectedUpdatedAt: seenAt });
  await assert.rejects(
    update.execute({ userId: 'u1', id: 'f1', dueDay: 7, expectedUpdatedAt: seenAt }),
    StaleDataError,
  );
});

test('operacoes em gasto de outro usuario viram FixedExpenseNotFoundError', async () => {
  const { update, del, setPaid } = await setup();
  await assert.rejects(update.execute({ userId: 'u1', id: 'f2', dueDay: 1 }), FixedExpenseNotFoundError);
  await assert.rejects(del.execute({ userId: 'u1', id: 'f2' }), FixedExpenseNotFoundError);
  await assert.rejects(setPaid.execute({ userId: 'u1', id: 'f2', paid: true }), FixedExpenseNotFoundError);
});

test('delete remove e devolve', async () => {
  const { repo, del } = await setup();
  assert.equal((await del.execute({ userId: 'u1', id: 'f1' })).id, 'f1');
  assert.equal(await repo.findById('u1', 'f1'), null);
});

test('delete apaga junto a Transaction vinculada do historico, sem estourar FK (spec 021, RF-62)', async () => {
  const { repo, transactions, del } = await setup();
  // o app nao cria mais transacoes vinculadas (RF-58); esta e historico de uma marcacao antiga.
  // A FK nao tem cascade, entao excluir o gasto fixo ainda precisa apagar a transacao antes.
  await transactions.save(legacyLinkedTransaction());

  await del.execute({ userId: 'u1', id: 'f1' });

  assert.equal(await repo.findById('u1', 'f1'), null);
  assert.equal(await transactions.findByFixedExpenseId('u1', 'f1'), null);
});

test('update aplica referenceMonth/description e preserva quando ausentes (spec 006)', async () => {
  const { repo, update } = await setup();

  const updated = await update.execute({
    userId: 'u1',
    id: 'f1',
    referenceMonth: 4,
    description: '  Aluguel apto  ',
  });
  assert.equal(updated.referenceMonth, 4);
  assert.equal(updated.description, 'Aluguel apto');

  const keptExisting = await update.execute({ userId: 'u1', id: 'f1', dueDay: 6 });
  assert.equal(keptExisting.referenceMonth, 4, 'referenceMonth preservado quando nao enviado');
  assert.equal(keptExisting.description, 'Aluguel apto', 'description preservada quando nao enviada');
  assert.equal((await repo.findById('u1', 'f1'))?.referenceMonth, 4);
});

test('update com referenceMonth invalido vira InvalidInputError antes do dominio (spec 006)', async () => {
  const { update } = await setup();

  await assert.rejects(
    update.execute({ userId: 'u1', id: 'f1', referenceMonth: 0 }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.ok(error.fieldErrors['referenceMonth']);
      return true;
    },
  );
});
