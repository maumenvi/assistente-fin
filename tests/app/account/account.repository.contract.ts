import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { type AccountRepository } from '../../../src/app/account/account.repository.port.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';

const account = (id: string, userId: string, name: string): Account =>
  Account.create({ id, userId, name, kind: 'checking', openingBalance: Money.zero() });

/**
 * Suite de contrato do `AccountRepository`.
 *
 * Reutilizavel: cada adaptador (fake hoje, Postgres/Prisma e outros no futuro) chama esta funcao
 * com uma fabrica que devolve um repositorio limpo. Garante o mesmo comportamento
 * observavel em qualquer banco (CA-19).
 */
export function runAccountRepositoryContract(
  label: string,
  createRepository: () => AccountRepository,
): void {
  test(`${label}: save + findById dentro do escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(account('a1', 'u1', 'Carteira'));

    const found = await repo.findById('u1', 'a1');
    assert.equal(found?.name, 'Carteira');
    assert.equal(await repo.findById('u1', 'inexistente'), null);
  });

  test(`${label}: findById nao vaza conta de outro usuario (CA-14)`, async () => {
    const repo = createRepository();
    await repo.save(account('a1', 'u1', 'Carteira'));

    assert.equal(await repo.findById('u2', 'a1'), null);
  });

  test(`${label}: save sobrescreve pelo id`, async () => {
    const repo = createRepository();
    await repo.save(account('a1', 'u1', 'Carteira'));
    await repo.save(account('a1', 'u1', 'Carteira Nova'));

    const all = await repo.listByUser('u1');
    assert.equal(all.length, 1);
    assert.equal(all[0]?.name, 'Carteira Nova');
  });

  test(`${label}: listByUser filtra por usuario e ordena por nome`, async () => {
    const repo = createRepository();
    await repo.save(account('a1', 'u1', 'Zulu'));
    await repo.save(account('a2', 'u1', 'Alfa'));
    await repo.save(account('a3', 'u2', 'Outro'));

    const names = (await repo.listByUser('u1')).map((a) => a.name);
    assert.deepEqual(names, ['Alfa', 'Zulu']);
  });

  test(`${label}: delete respeita o escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(account('a1', 'u1', 'Carteira'));

    await repo.delete('u2', 'a1');
    assert.ok(await repo.findById('u1', 'a1'), 'nao remove conta de outro usuario');

    await repo.delete('u1', 'a1');
    assert.equal(await repo.findById('u1', 'a1'), null);
    await repo.delete('u1', 'a1'); // idempotente, nao lanca
  });

  test(`${label}: save rejeita gravar sobre uma versao ja alterada (RF-31)`, async () => {
    const repo = createRepository();
    await repo.save(account('a1', 'u1', 'Carteira'));
    const v1 = await repo.findById('u1', 'a1');
    const v2 = await repo.findById('u1', 'a1');
    assert.ok(v1 && v2);
    await repo.save(v1);
    await assert.rejects(repo.save(v2), StaleDataError);
  });
}
