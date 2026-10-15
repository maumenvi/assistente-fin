import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SetUserDefaultAccountUseCase } from '../../../src/app/user/set.user.default.account.use.case.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { AccountNotFoundError } from '../../../src/domain/account/account.not.found.error.ts';
import { AccountArchivedError } from '../../../src/domain/account/account.archived.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { FakeAccountRepository } from '../../../src/database/fake/account.repository.fake.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const makeUseCase = async () => {
  const users = new FakeUserRepository();
  const accounts = new FakeAccountRepository();

  await users.save(
    User.create({
      id: 'u1',
      cpf: Cpf.create('52998224725'),
      email: Email.create('marco@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Marco',
      createdAt: NOW,
    }),
  );
  await users.save(
    User.create({
      id: 'u2',
      cpf: Cpf.create('11144477735'),
      email: Email.create('outro@exemplo.com'),
      phone: Phone.create('21987654321'),
      name: 'Outro',
      createdAt: NOW,
    }),
  );

  await accounts.save(
    Account.create({
      id: 'a1',
      userId: 'u1',
      name: 'Conta corrente',
      kind: 'checking',
      openingBalance: Money.fromCents(0),
    }),
  );
  const archived = Account.create({
    id: 'a2',
    userId: 'u1',
    name: 'Conta antiga',
    kind: 'savings',
    openingBalance: Money.fromCents(0),
  }).archive();
  await accounts.save(archived);
  await accounts.save(
    Account.create({
      id: 'a3',
      userId: 'u2',
      name: 'Conta do outro usuario',
      kind: 'checking',
      openingBalance: Money.fromCents(0),
    }),
  );

  return { users, accounts, useCase: new SetUserDefaultAccountUseCase(users, accounts) };
};

test('define a conta padrao com uma conta valida do proprio usuario', async () => {
  const { users, useCase } = await makeUseCase();

  const updated = await useCase.execute({ userId: 'u1', accountId: 'a1' });
  assert.equal(updated.defaultAccountId, 'a1');

  const persisted = await users.findById('u1');
  assert.equal(persisted?.defaultAccountId, 'a1');
});

test('accountId de outro usuario vira AccountNotFoundError (isolamento)', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'a3' }),
    AccountNotFoundError,
  );
});

test('accountId inexistente vira AccountNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'a-inexistente' }),
    AccountNotFoundError,
  );
});

test('accountId de conta arquivada vira AccountArchivedError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u1', accountId: 'a2' }),
    AccountArchivedError,
  );
});

test('accountId nulo limpa a preferencia existente (RF-4)', async () => {
  const { users, useCase } = await makeUseCase();

  await useCase.execute({ userId: 'u1', accountId: 'a1' });
  const cleared = await useCase.execute({ userId: 'u1', accountId: null });
  assert.equal(cleared.defaultAccountId, null);

  const persisted = await users.findById('u1');
  assert.equal(persisted?.defaultAccountId, null);
});

test('userId inexistente vira UserNotFoundError', async () => {
  const { useCase } = await makeUseCase();

  await assert.rejects(
    useCase.execute({ userId: 'u-inexistente', accountId: 'a1' }),
    UserNotFoundError,
  );
});
