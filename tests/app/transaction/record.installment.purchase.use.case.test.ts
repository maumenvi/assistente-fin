import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecordInstallmentPurchaseUseCase } from '../../../src/app/transaction/record.installment.purchase.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { seedDefaultCategory, DEFAULT_CATEGORY_ID } from '../../support/fake.categories.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const makeUseCase = async (
  options: { verified?: boolean; withAccount?: boolean; accountKind?: 'checking' | 'credit-card' } = {},
) => {
  const { verified = true, withAccount = true, accountKind = 'credit-card' } = options;
  const database = new FakeDatabase();
  const { transactions, users, accounts, categories } = database;

  let user = User.create({
    id: 'u1',
    cpf: Cpf.create('52998224725'),
    email: Email.create('marco@exemplo.com'),
    phone: Phone.create('11987654321'),
    name: 'Marco',
    createdAt: NOW,
  });
  if (verified) user = user.verifyEmail(NOW).verifyPhone(NOW);
  await users.save(user);

  if (withAccount) {
    await accounts.save(
      Account.create({
        id: 'acc1',
        userId: 'u1',
        name: accountKind === 'credit-card' ? 'Cartao' : 'Carteira',
        kind: accountKind,
        openingBalance: Money.zero(),
      }),
    );
  }

  await seedDefaultCategory(categories, 'u1');
  const useCase = new RecordInstallmentPurchaseUseCase(database, new SequentialIdGenerator('tx'));
  return { database, transactions, users, accounts, categories, useCase };
};

const validInput = {
  userId: 'u1',
  accountId: 'acc1',
  amountCents: 12_000,
  installments: 12,
  date: '2026-01-05T10:00:00.000Z',
};

test('compra de valor divisivel exatamente por N gera N transacoes de valor igual (RF-2/RF-3)', async () => {
  const { useCase } = await makeUseCase();

  const result = await useCase.execute({ ...validInput, amountCents: 1_200, installments: 12 });

  assert.equal(result.length, 12);
  assert.ok(result.every((t) => t.amount.cents === 100));
  assert.equal(result.reduce((sum, t) => sum + t.amount.cents, 0), 1_200);
});

test('compra com resto de centavos distribui corretamente e soma bate com o total (CA-2)', async () => {
  const { useCase } = await makeUseCase();

  const result = await useCase.execute({ ...validInput, amountCents: 1_000, installments: 3 });

  assert.deepEqual(
    result.map((t) => t.amount.cents),
    [334, 333, 333],
  );
  assert.equal(result.reduce((sum, t) => sum + t.amount.cents, 0), 1_000);
});

test('cada parcela mantem installmentGroupId, installmentNumber e installmentTotal (RF-4)', async () => {
  const { useCase } = await makeUseCase();

  const result = await useCase.execute({ ...validInput, amountCents: 300, installments: 3 });

  const groupIds = new Set(result.map((t) => t.installmentGroupId));
  assert.equal(groupIds.size, 1, 'todas as parcelas compartilham o mesmo grupo');
  assert.deepEqual(
    result.map((t) => t.installmentNumber),
    [1, 2, 3],
  );
  assert.ok(result.every((t) => t.installmentTotal === 3));
  assert.ok(result.every((t) => t.isInstallment()));
});

test('installments === 1 gera uma unica transacao comum, sem campos de parcela (RF-10/CA-9)', async () => {
  const { transactions, useCase } = await makeUseCase();

  const result = await useCase.execute({ ...validInput, amountCents: 5_000, installments: 1 });

  assert.equal(result.length, 1);
  const [transaction] = result;
  assert.equal(transaction!.installmentGroupId, null);
  assert.equal(transaction!.installmentNumber, null);
  assert.equal(transaction!.installmentTotal, null);
  assert.equal(transaction!.isInstallment(), false);
  assert.equal((await transactions.listByUser('u1')).length, 1);
});

test('conta que nao e credit-card tambem aceita parcelamento (spec 016, RF-1 - ex.: Pix parcelado)', async () => {
  const { transactions, useCase } = await makeUseCase({ accountKind: 'checking' });

  const result = await useCase.execute({ ...validInput, amountCents: 400, installments: 4 });

  assert.equal(result.length, 4);
  assert.ok(result.every((t) => t.accountId === 'acc1'));
  assert.equal((await transactions.listByUser('u1')).length, 4);
});

test('conta de outro usuario (ou inexistente) vira AccountNotFoundError', async () => {
  const { useCase } = await makeUseCase({ withAccount: false });

  await assert.rejects(useCase.execute(validInput), AccountNotFoundError);
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(useCase.execute({ ...validInput, userId: 'inexistente' }), UserNotFoundError);
});

test('usuario nao verificado vira UserNotVerifiedError', async () => {
  const { useCase } = await makeUseCase({ verified: false });

  await assert.rejects(useCase.execute(validInput), UserNotVerifiedError);
});

test('entrada invalida vira InvalidInputError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...validInput, installments: 0 }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'registrar compra parcelada');
      assert.ok(error.fieldErrors['installments']);
      return true;
    },
  );
});

test('sem categoria informada cai na padrao do usuario', async () => {
  const { useCase } = await makeUseCase();

  const [first] = await useCase.execute({ ...validInput, amountCents: 300, installments: 3 });

  assert.equal(first!.categoryId, DEFAULT_CATEGORY_ID);
});

test('datas avancam mes a mes a partir da compra (CA-1)', async () => {
  const { useCase } = await makeUseCase();

  const result = await useCase.execute({
    ...validInput,
    date: '2026-01-05T10:00:00.000Z',
    amountCents: 400,
    installments: 4,
  });

  const months = result.map((t) => t.date.toISOString().slice(0, 7));
  assert.deepEqual(months, ['2026-01', '2026-02', '2026-03', '2026-04']);
});

test('dia de mes inexistente clampa em fim de mes (decisao 4.6)', async () => {
  const { useCase } = await makeUseCase();

  const result = await useCase.execute({
    ...validInput,
    date: '2026-01-31T10:00:00.000Z',
    amountCents: 300,
    installments: 3,
  });

  const days = result.map((t) => t.date.toISOString().slice(0, 10));
  // fevereiro/2026 nao e bissexto -> clampa em 28; marco tem 31 dias -> volta ao dia 31
  assert.deepEqual(days, ['2026-01-31', '2026-02-28', '2026-03-31']);
});

test('todas as parcelas sao persistidas dentro de database.transaction (atomicidade)', async () => {
  const { database, useCase } = await makeUseCase();
  let depth = 0;
  const run = database.transaction.bind(database);
  database.transaction = async (work) => {
    depth += 1;
    try {
      return await run(work);
    } finally {
      depth -= 1;
    }
  };
  let savedInsideTransaction = 0;
  const saveTransaction = database.transactions.save.bind(database.transactions);
  database.transactions.save = async (transaction) => {
    if (depth > 0) savedInsideTransaction += 1;
    await saveTransaction(transaction);
  };

  await useCase.execute({ ...validInput, amountCents: 500, installments: 5 });

  assert.equal(savedInsideTransaction, 5, 'todas as 5 parcelas foram gravadas dentro da transacao');
});
