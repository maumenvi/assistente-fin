import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecordTransactionUseCase } from '../../../src/app/transaction/record.transaction.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../../src/domain/user/user.not.verified.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { DuplicateTransactionError } from '../../../src/domain/transaction/duplicate.transaction.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { addUtcMonths } from '../../../src/domain/shared/add.utc.months.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { seedDefaultCategory, DEFAULT_CATEGORY_ID } from '../../support/fake.categories.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const makeUseCase = async (options: { verified?: boolean; withAccount?: boolean } = {}) => {
  const { verified = true, withAccount = true } = options;
  const database = new FakeDatabase();
  const transactions = database.transactions;
  const users = database.users;
  const accounts = database.accounts;
  const categories = database.categories;

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
        name: 'Carteira',
        kind: 'checking',
        openingBalance: Money.zero(),
      }),
    );
  }

  await seedDefaultCategory(categories, 'u1');
  await categories.save(
    Category.create({ id: 'cat-mercado', userId: 'u1', name: CategoryName.create('Mercado') }),
  );
  const useCase = new RecordTransactionUseCase(database, new SequentialIdGenerator('tx'));
  return { database, transactions, users, accounts, categories, useCase };
};

const validInput = {
  userId: 'u1',
  date: '2026-01-05T10:00:00.000Z',
  amountCents: 5_000,
  type: 'expense',
  accountId: 'acc1',
};

test('registra a transacao com id gerado (RF-5)', async () => {
  const { transactions, useCase } = await makeUseCase();

  const transaction = await useCase.execute({ ...validInput, categoryId: 'cat-mercado' });

  assert.equal(transaction.id, 'tx-1');
  assert.equal(transaction.categoryId, 'cat-mercado');
  assert.equal((await transactions.listByUser('u1')).length, 1);
});

test('sem categoria informada cai na padrao do usuario (spec 003, CA-7)', async () => {
  const { useCase } = await makeUseCase();

  const transaction = await useCase.execute(validInput);

  assert.equal(transaction.categoryId, DEFAULT_CATEGORY_ID);
});

test('categoria digitada nova e criada e vinculada (CA-9)', async () => {
  const { categories, useCase } = await makeUseCase();

  const transaction = await useCase.execute({ ...validInput, categoryName: 'lazer' });

  assert.equal((await categories.findById('u1', transaction.categoryId))?.name.value, 'LAZER');
});

test('entrada invalida vira InvalidInputError (CA-11)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...validInput, amountCents: -1, type: 'transfer' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'registrar transacao');
      assert.ok(error.fieldErrors['amountCents']);
      assert.ok(error.fieldErrors['type']);
      return true;
    },
  );
});

test('usuario inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ ...validInput, userId: 'inexistente' }),
    UserNotFoundError,
  );
});

test('usuario nao verificado vira UserNotVerifiedError (RF-28)', async () => {
  const { useCase } = await makeUseCase({ verified: false });

  await assert.rejects(useCase.execute(validInput), UserNotVerifiedError);
});

test('conta inexistente (ou de outro usuario) vira AccountNotFoundError', async () => {
  const { useCase } = await makeUseCase({ withAccount: false });

  await assert.rejects(useCase.execute(validInput), AccountNotFoundError);
});

test('mesma conta+tipo+valor+dia vira DuplicateTransactionError (CA-5)', async () => {
  const { transactions, useCase } = await makeUseCase();

  await useCase.execute(validInput);

  await assert.rejects(
    useCase.execute({ ...validInput, date: '2026-01-05T23:00:00.000Z' }),
    DuplicateTransactionError,
  );
  assert.equal((await transactions.listByUser('u1')).length, 1, 'nao persistiu a duplicata');
});

test('mesmo valor em dia diferente nao e duplicata', async () => {
  const { transactions, useCase } = await makeUseCase();

  await useCase.execute(validInput);
  await useCase.execute({ ...validInput, date: '2026-01-06T10:00:00.000Z' });

  assert.equal((await transactions.listByUser('u1')).length, 2);
});

test('nao-repete -> uma unica linha, sem serie (CA-13)', async () => {
  const { database, transactions, useCase } = await makeUseCase();

  const tx = await useCase.execute({
    ...validInput,
    categoryId: 'cat-mercado',
    recurrence: { frequency: 'nao-repete' },
  });

  assert.equal(tx.seriesId, null);
  assert.equal((await transactions.listByUser('u1')).length, 1);
  assert.deepEqual(await database.transactionSeries.listByUser('u1'), []);
});

test('mensal de 05/01 a 05/07 -> 7 ocorrencias, uma por mes, mesmo seriesId (CA-16)', async () => {
  const { database, transactions, useCase } = await makeUseCase();

  const first = await useCase.execute({
    ...validInput,
    date: '2026-01-05T00:00:00.000Z',
    categoryId: 'cat-mercado',
    recurrence: { frequency: 'mensal', endDate: '2026-07-05T00:00:00.000Z' },
  });

  const occurrences = await transactions.listByUser('u1');
  assert.equal(occurrences.length, 7);
  const seriesIds = new Set(occurrences.map((o) => o.seriesId));
  assert.equal(seriesIds.size, 1, 'todas na mesma serie');
  assert.equal(first.seriesId, [...seriesIds][0]);

  const months = occurrences.map((o) => o.date.toISOString().slice(0, 7)).sort();
  assert.deepEqual(months, [
    '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
  ]);

  const [series] = await database.transactionSeries.listByUser('u1');
  assert.equal(series?.anchorDate.toISOString(), '2026-01-05T00:00:00.000Z');
  assert.equal(series?.recurrence.frequency, 'mensal');
});

test('quinzenal (semanal a cada 2) -> ocorrencias a cada 14 dias (CA-18a)', async () => {
  const { transactions, useCase } = await makeUseCase();

  await useCase.execute({
    ...validInput,
    date: '2026-01-05T00:00:00.000Z',
    categoryId: 'cat-mercado',
    recurrence: { frequency: 'semanal', everyN: 2, endDate: '2026-03-05T00:00:00.000Z' },
  });

  const days = (await transactions.listByUser('u1'))
    .map((o) => o.date.toISOString().slice(0, 10))
    .sort();
  assert.deepEqual(days, ['2026-01-05', '2026-01-19', '2026-02-02', '2026-02-16', '2026-03-02']);
});

test('materializacao nao roda dedup - ocorrencia igual a lancamento manual pre-existente e criada', async () => {
  const { transactions, useCase } = await makeUseCase();
  await useCase.execute({
    ...validInput,
    date: '2026-02-05T00:00:00.000Z',
    categoryId: 'cat-mercado',
  }); // lancamento avulso

  await useCase.execute({
    ...validInput,
    date: '2026-01-05T00:00:00.000Z',
    categoryId: 'cat-mercado',
    recurrence: { frequency: 'mensal', endDate: '2026-04-05T00:00:00.000Z' },
  });

  // 1 avulso + 4 ocorrencias (jan..abr) - a de fevereiro NAO foi barrada pela dedup
  const all = await transactions.listByUser('u1');
  assert.equal(all.length, 5);
  assert.equal(all.filter((t) => t.seriesId !== null).length, 4);
});

test('lancamento manual igual a uma ocorrencia ja gerada vira DuplicateTransactionError (CA-22)', async () => {
  const { transactions, useCase } = await makeUseCase();

  await useCase.execute({
    ...validInput,
    date: '2026-01-05T00:00:00.000Z',
    categoryId: 'cat-mercado',
    recurrence: { frequency: 'mensal', endDate: '2026-04-05T00:00:00.000Z' },
  });
  // 4 ocorrencias jan..abr

  // agora o usuario tenta lancar a mao algo igual a ocorrencia de marco
  await assert.rejects(
    useCase.execute({
      ...validInput,
      date: '2026-03-05T18:00:00.000Z',
      categoryId: 'cat-mercado',
    }),
    DuplicateTransactionError,
  );
  assert.equal((await transactions.listByUser('u1')).length, 4, 'nada foi adicionado');
});

test('serie recorrente e as ocorrencias caem na MESMA transacao', async () => {
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
  let seriesSavedAt = -1;
  const saveSeries = database.transactionSeries.save.bind(database.transactionSeries);
  database.transactionSeries.save = async (series) => {
    seriesSavedAt = depth;
    await saveSeries(series);
  };

  await useCase.execute({
    ...validInput,
    categoryId: 'cat-mercado',
    recurrence: { frequency: 'mensal', endDate: addUtcMonths(new Date(validInput.date), 3).toISOString() },
  });

  assert.equal(seriesSavedAt, 1, 'a serie foi gravada dentro da transacao');
});

test('type income + accountId: cria Income espelho e a Transaction sai com incomeId (spec 012, RF-5)', async () => {
  const { database, useCase } = await makeUseCase();

  const transaction = await useCase.execute({
    ...validInput,
    type: 'income',
    categoryId: 'cat-mercado',
  });

  assert.ok(transaction.incomeId, 'transacao salva com incomeId');
  const income = await database.incomes.findById('u1', transaction.incomeId!);
  assert.ok(income);
  assert.equal(income?.accountId, 'acc1');
  assert.equal(income?.amount.cents, 5_000);
  assert.equal(income?.categoryId, 'cat-mercado');
  assert.equal(income?.date.toISOString(), new Date(validInput.date).toISOString());
  assert.equal((await database.incomes.listByUser('u1')).length, 1);
});

test('type expense: nao cria nenhum Income (comportamento atual)', async () => {
  const { database, useCase } = await makeUseCase();

  const transaction = await useCase.execute({ ...validInput, categoryId: 'cat-mercado' });

  assert.equal(transaction.incomeId, null);
  assert.equal((await database.incomes.listByUser('u1')).length, 0);
});

test('type income recorrente: Income espelho criado e TODAS as ocorrencias materializadas recebem o mesmo incomeId (spec 012, RF-5 estendido)', async () => {
  const { database, useCase } = await makeUseCase();

  const transaction = await useCase.execute({
    ...validInput,
    type: 'income',
    categoryId: 'cat-mercado',
    recurrence: { frequency: 'mensal', endDate: addUtcMonths(new Date(validInput.date), 3).toISOString() },
  });

  assert.ok(transaction.incomeId, 'primeira ocorrencia (ancora) tem incomeId');
  const income = await database.incomes.findById('u1', transaction.incomeId!);
  assert.ok(income);

  const occurrences = (await database.transactions.listByUser('u1')).filter(
    (t) => t.seriesId === transaction.seriesId,
  );
  assert.ok(occurrences.length > 1, 'materializou mais de uma ocorrencia');
  assert.ok(
    occurrences.every((t) => t.incomeId === transaction.incomeId),
    'todas as ocorrencias tem o mesmo incomeId, nao so a 1a',
  );
  assert.equal((await database.incomes.listByUser('u1')).length, 1, 'so um Income espelho criado');
});

test('type expense recorrente: nenhuma ocorrencia materializada tem incomeId (regressao)', async () => {
  const { database, useCase } = await makeUseCase();

  const transaction = await useCase.execute({
    ...validInput,
    categoryId: 'cat-mercado',
    recurrence: { frequency: 'mensal', endDate: addUtcMonths(new Date(validInput.date), 3).toISOString() },
  });

  const occurrences = (await database.transactions.listByUser('u1')).filter(
    (t) => t.seriesId === transaction.seriesId,
  );
  assert.ok(occurrences.length > 1);
  assert.ok(occurrences.every((t) => t.incomeId === null));
  assert.equal((await database.incomes.listByUser('u1')).length, 0);
});
