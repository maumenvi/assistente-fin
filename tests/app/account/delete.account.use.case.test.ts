import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeleteAccountUseCase } from '../../../src/app/account/delete.account.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';

const makeUseCase = async () => {
  const database = new FakeDatabase();
  await database.accounts.save(
    Account.create({
      id: 'a1',
      userId: 'u1',
      name: 'Carteira',
      kind: 'checking',
      openingBalance: Money.zero(),
    }),
  );
  return { accounts: database.accounts, transactions: database.transactions, useCase: new DeleteAccountUseCase(database) };
};

test('remove a conta do escopo do usuario e devolve o que foi removido (RF-1)', async () => {
  const { accounts, useCase } = await makeUseCase();

  const removed = await useCase.execute({ id: 'a1', userId: 'u1' });

  assert.equal(removed.id, 'a1');
  assert.equal(await accounts.findById('u1', 'a1'), null);
});

test('apaga junto as transacoes vinculadas a conta, sem tocar em transacoes de outras contas (spec 015)', async () => {
  const { accounts, transactions, useCase } = await makeUseCase();
  await accounts.save(
    Account.create({
      id: 'a2',
      userId: 'u1',
      name: 'Outra conta',
      kind: 'checking',
      openingBalance: Money.zero(),
    }),
  );
  await transactions.save(
    Transaction.create({
      id: 'tx-a1',
      userId: 'u1',
      date: new Date('2026-01-05'),
      amount: Money.fromCents(1_000),
      type: 'expense',
      categoryId: 'cat-1',
      accountId: 'a1',
    }),
  );
  await transactions.save(
    Transaction.create({
      id: 'tx-a2',
      userId: 'u1',
      date: new Date('2026-01-05'),
      amount: Money.fromCents(2_000),
      type: 'expense',
      categoryId: 'cat-1',
      accountId: 'a2',
    }),
  );

  await useCase.execute({ id: 'a1', userId: 'u1' });

  assert.equal(await transactions.findById('u1', 'tx-a1'), null, 'transacao da conta excluida some');
  assert.ok(await transactions.findById('u1', 'tx-a2'), 'transacao de outra conta permanece');
});

test('conta inexistente ou de outro usuario vira AccountNotFoundError (CA-14)', async () => {
  const { accounts, useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ id: 'inexistente', userId: 'u1' }), AccountNotFoundError);
  await assert.rejects(useCase.execute({ id: 'a1', userId: 'u2' }), AccountNotFoundError);

  assert.ok(await accounts.findById('u1', 'a1'), 'nao deveria ter removido nada');
});

test('entrada invalida vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ id: '', userId: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'excluir conta');
      return true;
    },
  );
});
