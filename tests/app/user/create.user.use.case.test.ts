import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateUserUseCase } from '../../../src/app/user/create.user.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { InvalidCpfError } from '../../../src/domain/shared/invalid.cpf.error.ts';
import { InvalidEmailError } from '../../../src/domain/shared/invalid.email.error.ts';
import { InvalidPhoneError } from '../../../src/domain/shared/invalid.phone.error.ts';
import { CpfAlreadyRegisteredError } from '../../../src/domain/user/cpf.already.registered.error.ts';
import { EmailAlreadyRegisteredError } from '../../../src/domain/user/email.already.registered.error.ts';
import { PhoneAlreadyRegisteredError } from '../../../src/domain/user/phone.already.registered.error.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z');

const VALID_INPUT = {
  cpf: '529.982.247-25',
  email: 'marco@exemplo.com',
  phone: '11987654321',
  name: '  Marco  ',
};

const makeUseCase = () => {
  const database = new FakeDatabase();
  const useCase = new CreateUserUseCase(
    database,
    new SequentialIdGenerator('user'),
    new FixedClock(FIXED_NOW),
  );
  return { database, users: database.users, categories: database.categories, useCase };
};

test('cria o usuario com id gerado, cpf/email/phone normalizados, createdAt do clock e nao verificado (RF-15, RF-23, RF-26)', async () => {
  const { users, useCase } = makeUseCase();

  const user = await useCase.execute(VALID_INPUT);

  assert.equal(user.id, 'user-1');
  assert.equal(user.cpf.digits, '52998224725');
  assert.equal(user.email.value, 'marco@exemplo.com');
  assert.equal(user.phone.value, '+5511987654321');
  assert.equal(user.name, 'Marco');
  assert.equal(user.createdAt, FIXED_NOW);
  assert.equal(user.isVerified(), false, 'usuario alem do 1o nasce nao verificado');
  assert.equal((await users.findById('user-1'))?.name, 'Marco');
});

test('entrada invalida (zod) vira InvalidInputError (CA-11)', async () => {
  const { useCase } = makeUseCase();

  await assert.rejects(
    useCase.execute({ cpf: '', email: '', phone: '', name: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'criar usuario');
      assert.ok(error.fieldErrors['cpf']);
      assert.ok(error.fieldErrors['email']);
      assert.ok(error.fieldErrors['phone']);
      assert.ok(error.fieldErrors['name']);
      return true;
    },
  );
});

test('cpf malformado vira InvalidCpfError (erro de dominio, nao zod)', async () => {
  const { useCase } = makeUseCase();

  await assert.rejects(
    useCase.execute({ ...VALID_INPUT, cpf: '111.111.111-11' }),
    InvalidCpfError,
  );
});

test('email malformado vira InvalidEmailError (erro de dominio, nao zod)', async () => {
  const { useCase } = makeUseCase();

  await assert.rejects(useCase.execute({ ...VALID_INPUT, email: 'nao-e-email' }), InvalidEmailError);
});

test('telefone malformado vira InvalidPhoneError (erro de dominio, nao zod)', async () => {
  const { useCase } = makeUseCase();

  await assert.rejects(useCase.execute({ ...VALID_INPUT, phone: '123' }), InvalidPhoneError);
});

test('cpf ja cadastrado vira CpfAlreadyRegisteredError (CA-13)', async () => {
  const { useCase } = makeUseCase();

  await useCase.execute(VALID_INPUT);

  await assert.rejects(
    useCase.execute({ ...VALID_INPUT, email: 'outro@exemplo.com', phone: '21987654321', name: 'Outro' }),
    CpfAlreadyRegisteredError,
  );
});

test('email ja cadastrado vira EmailAlreadyRegisteredError (RF-23)', async () => {
  const { useCase } = makeUseCase();

  await useCase.execute(VALID_INPUT);

  await assert.rejects(
    useCase.execute({ ...VALID_INPUT, cpf: '11144477735', phone: '21987654321', name: 'Outro' }),
    EmailAlreadyRegisteredError,
  );
});

test('telefone ja cadastrado vira PhoneAlreadyRegisteredError (RF-23)', async () => {
  const { useCase } = makeUseCase();

  await useCase.execute(VALID_INPUT);

  await assert.rejects(
    useCase.execute({ ...VALID_INPUT, cpf: '11144477735', email: 'outro@exemplo.com', name: 'Outro' }),
    PhoneAlreadyRegisteredError,
  );
});

test('nao persiste nada quando a entrada e invalida ou algum dado ja existe', async () => {
  const { users, useCase } = makeUseCase();

  await useCase.execute(VALID_INPUT);
  await useCase.execute({ cpf: '', email: '', phone: '', name: '' }).catch(() => undefined);
  await useCase
    .execute({ ...VALID_INPUT, email: 'outro@exemplo.com', phone: '21987654321', name: 'Outro' })
    .catch(() => undefined);

  assert.equal((await users.findById('user-1')) !== null, true);
  // conta usuarios em vez de checar 'user-2': os ids agora sao compartilhados com a
  // categoria padrao criada junto (spec 003, RF-8), entao 'user-2' e a categoria de 'user-1'
  assert.equal((await users.listAll()).length, 1, 'nenhum usuario a mais foi gravado');
});

test('o usuario novo ja nasce com a categoria padrao "SEM CATEGORIA" (RF-8, CA-5)', async () => {
  const { categories, useCase } = makeUseCase();

  const user = await useCase.execute(VALID_INPUT);

  const listed = await categories.listByUser(user.id);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.name.value, 'SEM CATEGORIA');
  assert.equal(listed[0]?.isDefault, true);
  assert.equal((await categories.findDefault(user.id))?.id, listed[0]?.id);
});

test('cada usuario ganha a sua propria categoria padrao', async () => {
  const { categories, useCase } = makeUseCase();

  const first = await useCase.execute(VALID_INPUT);
  const second = await useCase.execute({
    cpf: '111.444.777-35',
    email: 'outro@exemplo.com',
    phone: '21987654321',
    name: 'Outro',
  });

  const one = await categories.findDefault(first.id);
  const other = await categories.findDefault(second.id);
  assert.ok(one && other);
  assert.notEqual(other.id, one.id);
});

test('usuario e categoria padrao sao gravados na MESMA transacao', async () => {
  // o `FakeDatabase.transaction` roda `work` direto, sem rollback - atomicidade de verdade e
  // do adaptador Prisma. O que da pra fixar aqui, e e o que importa nesta camada, e que os
  // dois `save` acontecem dentro da unidade de trabalho, nao soltos um apos o outro.
  const { database, categories, useCase } = makeUseCase();
  let depth = 0;
  const runTransaction = database.transaction.bind(database);
  database.transaction = async (work) => {
    depth += 1;
    try {
      return await runTransaction(work);
    } finally {
      depth -= 1;
    }
  };
  let categorySavedAtDepth = -1;
  const saveCategory = categories.save.bind(categories);
  categories.save = async (category) => {
    categorySavedAtDepth = depth;
    await saveCategory(category);
  };

  await useCase.execute(VALID_INPUT);

  assert.equal(categorySavedAtDepth, 1, 'a categoria padrao foi gravada dentro da transacao');
});
