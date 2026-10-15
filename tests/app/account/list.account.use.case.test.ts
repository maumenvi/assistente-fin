import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ListAccountsUseCase } from '../../../src/app/account/list.account.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeAccountRepository } from '../../../src/database/fake/account.repository.fake.ts';

const account = (id: string, userId: string, name: string): Account =>
  Account.create({ id, userId, name, kind: 'checking', openingBalance: Money.zero() });

test('lista so as contas do usuario, ordenadas por nome (RF-1, RF-16)', async () => {
  const accounts = new FakeAccountRepository();
  await accounts.save(account('a1', 'u1', 'Zulu'));
  await accounts.save(account('a2', 'u1', 'Alfa'));
  await accounts.save(account('a3', 'u2', 'Outro'));

  const useCase = new ListAccountsUseCase(accounts);
  const result = await useCase.execute({ userId: 'u1' });

  assert.deepEqual(result.map((a) => a.name), ['Alfa', 'Zulu']);
});

test('entrada invalida vira InvalidInputError (CA-11)', async () => {
  const useCase = new ListAccountsUseCase(new FakeAccountRepository());

  await assert.rejects(
    useCase.execute({ userId: '' }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.context, 'listar contas');
      return true;
    },
  );
});
