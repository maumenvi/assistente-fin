import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateFirstUserUseCase } from '../../../src/app/user/create.first.user.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { CpfAlreadyRegisteredError } from '../../../src/domain/user/cpf.already.registered.error.ts';
import { InvalidCpfError } from '../../../src/domain/shared/invalid.cpf.error.ts';
import { type PasswordHasher } from '../../../src/app/shared/password.hasher.port.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { FakePasswordHasher } from '../../support/fake.password.hasher.ts';
import { FakeRecoveryKeyGenerator } from '../../support/fake.recovery.key.generator.ts';
import { FixedClock } from '../../support/fixed.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const input = {
  cpf: '529.982.247-25',
  email: 'marco@exemplo.com',
  phone: '11987654321',
  name: 'Marco',
};

const build = (hasher: PasswordHasher = new FakePasswordHasher()) => {
  const database = new FakeDatabase();
  const useCase = new CreateFirstUserUseCase(
    database,
    new SequentialIdGenerator('u'),
    new FixedClock(NOW),
    hasher,
    new FakeRecoveryKeyGenerator(),
  );
  return { database, useCase };
};

test('sem senha: cria o usuario ja verificado, sem chave de recuperacao', async () => {
  const { database, useCase } = build();

  const { user, recoveryKey } = await useCase.execute(input);

  assert.equal(user.name, 'Marco');
  assert.equal(user.hasPassword(), false);
  assert.equal(recoveryKey, undefined);
  // 1o usuario nasce com os dois canais verificados (decisao 2026-09-08)
  assert.equal(user.emailVerifiedAt?.getTime(), NOW.getTime());
  assert.equal(user.phoneVerifiedAt?.getTime(), NOW.getTime());
  assert.equal(user.isVerified(), true);
  const persisted = await database.users.findById(user.id);
  assert.equal(persisted?.hasAllChannelsVerified(), true);
  assert.equal((await database.users.listAll()).length, 1);
});

test('com senha: grava senha + chave de recuperacao no mesmo save e emite a chave uma vez', async () => {
  const { database, useCase } = build();

  const { user, recoveryKey } = await useCase.execute({ ...input, password: 'segredo' });

  assert.equal(recoveryKey, 'RECOVERY-KEY-0001');
  const persisted = await database.users.findById(user.id);
  assert.equal(persisted?.passwordHash, 'hashed:segredo');
  assert.equal(persisted?.recoveryKeyHash, 'hashed:RECOVERY-KEY-0001');
});

test('senha curta -> InvalidInputError, nada persistido', async () => {
  const { database, useCase } = build();

  await assert.rejects(useCase.execute({ ...input, password: 'ab' }), InvalidInputError);
  assert.deepEqual(await database.users.listAll(), []);
});

test('CPF ja cadastrado -> CpfAlreadyRegisteredError', async () => {
  const { database, useCase } = build();
  await useCase.execute(input);

  await assert.rejects(
    useCase.execute({ ...input, email: 'outro@exemplo.com', phone: '21987654321' }),
    CpfAlreadyRegisteredError,
  );
  assert.equal((await database.users.listAll()).length, 1);
});

test('CPF malformado -> erro de dominio, nada persistido', async () => {
  const { database, useCase } = build();

  await assert.rejects(useCase.execute({ ...input, cpf: '111' }), InvalidCpfError);
  assert.deepEqual(await database.users.listAll(), []);
});

test('falha ao hashear a senha aborta tudo: nenhum usuario persistido (transacional)', async () => {
  const explode: PasswordHasher = {
    hash: async () => {
      throw new Error('hasher indisponivel');
    },
    verify: async () => false,
  };
  const { database, useCase } = build(explode);

  await assert.rejects(useCase.execute({ ...input, password: 'segredo' }), /hasher indisponivel/);
  assert.deepEqual(await database.users.listAll(), [], 'nenhum usuario meio-criado');
});

test('o 1o usuario ja nasce com a categoria padrao "SEM CATEGORIA" (RF-8, CA-5)', async () => {
  const { database, useCase } = build();

  const { user } = await useCase.execute(input);

  const listed = await database.categories.listByUser(user.id);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.name.value, 'SEM CATEGORIA');
  assert.equal(listed[0]?.isDefault, true);
});

test('com senha: usuario, senha e categoria padrao saem na mesma transacao', async () => {
  const { database, useCase } = build();
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
  const saveCategory = database.categories.save.bind(database.categories);
  database.categories.save = async (category) => {
    categorySavedAtDepth = depth;
    await saveCategory(category);
  };

  const { user } = await useCase.execute({ ...input, password: 'senha-forte-1' });

  assert.equal(user.hasPassword(), true);
  assert.equal(categorySavedAtDepth, 1);
});
