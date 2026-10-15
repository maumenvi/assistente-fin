import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateAccountUseCase } from '../../../src/app/account/create.account.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const makeUseCase = async (options: { verified?: boolean } = {}) => {
  const { verified = true } = options;
  const database = new FakeDatabase();

  let user = User.create({
    id: 'u1',
    cpf: Cpf.create('52998224725'),
    email: Email.create('marco@exemplo.com'),
    phone: Phone.create('11987654321'),
    name: 'Marco',
    createdAt: NOW,
  });
  if (verified) {
    user = user.verifyEmail(NOW).verifyPhone(NOW);
  }
  await database.users.save(user);

  const useCase = new CreateAccountUseCase(database, new SequentialIdGenerator('acc'));
  return { accounts: database.accounts, transactions: database.transactions, categories: database.categories, useCase };
};

test('cria a conta com id gerado e a persiste (CA-1)', async () => {
  const { accounts, useCase } = await makeUseCase();

  const account = await useCase.execute({
    userId: 'u1',
    name: '  Nubank  ',
    kind: 'checking',
    openingBalanceCents: 15_000,
    openingBalanceDate: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(account.id, 'acc-1');
  assert.equal(account.name, 'Nubank');
  assert.equal(account.openingBalance.cents, 15_000);
  assert.equal((await accounts.listByUser('u1')).length, 1);
});

test('openingBalanceCents > 0 em cartao de credito gera uma transacao de despesa "SALDO INICIAL" (saldo inicial = divida, spec 015)', async () => {
  const { transactions, categories, useCase } = await makeUseCase();

  const account = await useCase.execute({
    userId: 'u1',
    name: 'Cartao',
    kind: 'credit-card',
    openingBalanceCents: 12_345,
    openingBalanceDate: '2026-01-01T00:00:00.000Z',
  });

  const txs = (await transactions.listByUser('u1')).filter((tx) => tx.accountId === account.id);
  assert.equal(txs.length, 1);
  assert.equal(txs[0]!.type, 'expense');
  assert.equal(txs[0]!.amount.cents, 12_345);

  const category = await categories.findById('u1', txs[0]!.categoryId);
  assert.equal(category?.isSystemOpeningBalance, true);
  assert.equal(category?.name.value, 'SALDO INICIAL');
});

test('openingBalanceCents > 0 em conta comum gera uma transacao de ganho "SALDO INICIAL" (saldo inicial = dinheiro disponivel, bug corrigido: antes derrubava o saldo calculado)', async () => {
  const { transactions, useCase } = await makeUseCase();

  const account = await useCase.execute({
    userId: 'u1',
    name: 'Itau',
    kind: 'checking',
    openingBalanceCents: 95_756,
    openingBalanceDate: '2026-01-01T00:00:00.000Z',
  });

  const txs = (await transactions.listByUser('u1')).filter((tx) => tx.accountId === account.id);
  assert.equal(txs.length, 1);
  assert.equal(txs[0]!.type, 'income');
  assert.equal(txs[0]!.amount.cents, 95_756);
});

test('openingBalanceCents > 0 em conta-beneficio tambem gera ganho, nao divida (spec 016, RF-14)', async () => {
  const { transactions, useCase } = await makeUseCase();

  const account = await useCase.execute({
    userId: 'u1',
    name: 'Vale Alimentacao',
    kind: 'meal-voucher',
    openingBalanceCents: 40_000,
    openingBalanceDate: '2026-01-01T00:00:00.000Z',
    isBenefit: true,
  });

  const txs = (await transactions.listByUser('u1')).filter((tx) => tx.accountId === account.id);
  assert.equal(txs.length, 1);
  assert.equal(txs[0]!.type, 'income', 'beneficio e saldo disponivel, mesma regra de conta comum (RF-14)');
  assert.equal(txs[0]!.amount.cents, 40_000);
});

test('a transacao "SALDO INICIAL" nasce na openingBalanceDate informada, NAO na data do cadastro (revisao do bug de saldo inicial vs. saldo atual)', async () => {
  const { transactions, useCase } = await makeUseCase();

  const account = await useCase.execute({
    userId: 'u1',
    name: 'Itau',
    kind: 'checking',
    openingBalanceCents: 95_756,
    openingBalanceDate: '2026-09-17T00:00:00.000Z',
  });

  const [tx] = (await transactions.listByUser('u1')).filter((t) => t.accountId === account.id);
  assert.equal(tx!.date.toISOString(), new Date('2026-09-17T00:00:00.000Z').toISOString());
  assert.equal(account.openingBalanceDate?.toISOString(), new Date('2026-09-17T00:00:00.000Z').toISOString());
});

test('openingBalanceCents > 0 sem openingBalanceDate vira InvalidInputError (invariante de dominio)', async () => {
  const { accounts, useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', name: 'Conta', kind: 'checking', openingBalanceCents: 1_000 }),
  );
  assert.equal((await accounts.listByUser('u1')).length, 0);
});

test('openingBalanceCents igual a 0 nao gera nenhuma transacao', async () => {
  const { transactions, useCase } = await makeUseCase();

  const account = await useCase.execute({
    userId: 'u1',
    name: 'Conta',
    kind: 'checking',
    openingBalanceCents: 0,
  });

  const txs = (await transactions.listByUser('u1')).filter((tx) => tx.accountId === account.id);
  assert.equal(txs.length, 0);
});

test('chamadas seguidas reusam a mesma categoria de sistema "SALDO INICIAL" (idempotente)', async () => {
  const { transactions, useCase } = await makeUseCase();

  const first = await useCase.execute({
    userId: 'u1',
    name: 'Conta 1',
    kind: 'checking',
    openingBalanceCents: 1_000,
    openingBalanceDate: '2026-01-01T00:00:00.000Z',
  });
  const second = await useCase.execute({
    userId: 'u1',
    name: 'Conta 2',
    kind: 'checking',
    openingBalanceCents: 2_000,
    openingBalanceDate: '2026-01-01T00:00:00.000Z',
  });

  const firstTx = (await transactions.listByUser('u1')).find((tx) => tx.accountId === first.id)!;
  const secondTx = (await transactions.listByUser('u1')).find((tx) => tx.accountId === second.id)!;
  assert.equal(firstTx.categoryId, secondTx.categoryId);
});

test('entrada invalida vira InvalidInputError com erros por campo (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: '', name: '', kind: 'poupanca', openingBalanceCents: 1.5 }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'criar conta');
      assert.ok(error.fieldErrors['userId']);
      assert.ok(error.fieldErrors['name']);
      assert.ok(error.fieldErrors['kind']);
      assert.ok(error.fieldErrors['openingBalanceCents']);
      return true;
    },
  );
});

test('usuario inexistente vira UserNotFoundError (RF-15)', async () => {
  const { accounts, useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({
      userId: 'inexistente',
      name: 'Conta',
      kind: 'checking',
      openingBalanceCents: 0,
    }),
    UserNotFoundError,
  );
  assert.equal((await accounts.listByUser('inexistente')).length, 0);
});

test('usuario com e-mail/telefone nao verificados vira UserNotVerifiedError (RF-28, CA-24)', async () => {
  const { accounts, useCase } = await makeUseCase({ verified: false });

  await assert.rejects(
    useCase.execute({ userId: 'u1', name: 'Conta', kind: 'checking', openingBalanceCents: 0 }),
    UserNotVerifiedError,
  );
  assert.equal((await accounts.listByUser('u1')).length, 0);
});

test('cria conta credit-card com creditLimitCents/closingDay/dueDay (spec 008 revisao, RF-1, RF-2)', async () => {
  const { useCase } = await makeUseCase();

  const account = await useCase.execute({
    userId: 'u1',
    name: 'Cartao Nubank',
    kind: 'credit-card',
    openingBalanceCents: 0,
    creditLimitCents: 500_000,
    closingDay: 20,
    dueDay: 10,
  });

  assert.equal(account.creditLimit?.cents, 500_000);
  assert.equal(account.closingDay, 20);
  assert.equal(account.dueDay, 10);
});

test('closingDay igual a dueDay vira InvalidInputError de dominio (spec 008 revisao)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({
      userId: 'u1',
      name: 'Cartao Nubank',
      kind: 'credit-card',
      openingBalanceCents: 0,
      creditLimitCents: 500_000,
      closingDay: 10,
      dueDay: 10,
    }),
  );
});

test('creditLimitCents/closingDay/dueDay em conta de outro kind vira InvalidInputError de dominio (RF-3)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({
      userId: 'u1',
      name: 'Conta',
      kind: 'checking',
      openingBalanceCents: 0,
      creditLimitCents: 500_000,
      closingDay: 20,
      dueDay: 10,
    }),
  );
});

test('cria conta com isBenefit true, para qualquer kind (spec 011, RF-9)', async () => {
  const { useCase } = await makeUseCase();

  const account = await useCase.execute({
    userId: 'u1',
    name: 'Vale Alimentacao',
    kind: 'meal-voucher',
    openingBalanceCents: 0,
    isBenefit: true,
  });

  assert.equal(account.isBenefit, true);
});

test('cria conta sem isBenefit informado nasce isBenefit false (RF-9a)', async () => {
  const { useCase } = await makeUseCase();

  const account = await useCase.execute({
    userId: 'u1',
    name: 'Conta',
    kind: 'checking',
    openingBalanceCents: 0,
  });

  assert.equal(account.isBenefit, false);
});

test('nao persiste nada quando a entrada e invalida, o usuario nao existe ou nao esta verificado', async () => {
  const { accounts, useCase } = await makeUseCase();

  await useCase.execute({ userId: 'u1', name: 'ok', kind: 'wallet', openingBalanceCents: 0 })
    .catch(() => undefined);
  await useCase.execute({ userId: 'u1' }).catch(() => undefined);
  await useCase
    .execute({ userId: 'inexistente', name: 'ok', kind: 'wallet', openingBalanceCents: 0 })
    .catch(() => undefined);

  assert.equal((await accounts.listByUser('u1')).length, 1);
});
