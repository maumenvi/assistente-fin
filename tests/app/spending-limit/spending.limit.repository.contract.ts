import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { type SpendingLimitRepository } from '../../../src/app/spending-limit/spending.limit.repository.port.ts';
import { SpendingLimit } from '../../../src/domain/spending-limit/spending.limit.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

const spendingLimit = (id: string, userId: string, categoryId: string): SpendingLimit =>
  SpendingLimit.create({
    id,
    userId,
    categoryId,
    period: Month.create({ year: 2026, month: 1 }),
    maxAmount: Money.fromCents(50_000),
  });

/**
 * Suite de contrato do `SpendingLimitRepository`.
 *
 * Reutilizavel: cada adaptador (fake hoje, Prisma tambem) chama esta funcao com uma fabrica
 * que devolve um repositorio limpo. Garante o mesmo comportamento observavel em qualquer
 * banco (CA-19, CA-20).
 */
export function runSpendingLimitRepositoryContract(
  label: string,
  createRepository: () => SpendingLimitRepository,
): void {
  test(`${label}: save + findById dentro do escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(spendingLimit('sl1', 'u1', 'cat1c'));

    const found = await repo.findById('u1', 'sl1');
    assert.equal(found?.categoryId, 'cat1c');
    assert.equal(await repo.findById('u1', 'inexistente'), null);
  });

  test(`${label}: findById nao vaza limite de outro usuario (CA-14)`, async () => {
    const repo = createRepository();
    await repo.save(spendingLimit('sl1', 'u1', 'cat1c'));

    assert.equal(await repo.findById('u2', 'sl1'), null);
  });

  test(`${label}: save sobrescreve pelo id`, async () => {
    const repo = createRepository();
    await repo.save(spendingLimit('sl1', 'u1', 'cat1'));
    await repo.save(spendingLimit('sl1', 'u1', 'cat1b'));

    const all = await repo.listByUser('u1');
    assert.equal(all.length, 1);
    assert.equal(all[0]?.categoryId, 'cat1b');
  });

  test(`${label}: listByUser filtra por usuario e ordena por categoria`, async () => {
    const repo = createRepository();
    await repo.save(spendingLimit('sl1', 'u1', 'cat1b')); // TRANSPORTE
    await repo.save(spendingLimit('sl2', 'u1', 'cat1')); // MERCADO
    await repo.save(spendingLimit('sl3', 'u2', 'cat2'));

    const ids = (await repo.listByUser('u1')).map((l) => l.categoryId);
    assert.deepEqual(ids, ['cat1', 'cat1b'], 'ordenado por categoryId');
  });

  test(`${label}: delete respeita o escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(spendingLimit('sl1', 'u1', 'cat1c'));

    await repo.delete('u2', 'sl1');
    assert.ok(await repo.findById('u1', 'sl1'), 'nao remove limite de outro usuario');

    await repo.delete('u1', 'sl1');
    assert.equal(await repo.findById('u1', 'sl1'), null);
    await repo.delete('u1', 'sl1'); // idempotente, nao lanca
  });

  test(`${label}: save rejeita gravar sobre uma versao ja alterada (RF-31)`, async () => {
    const repo = createRepository();
    await repo.save(spendingLimit('sl1', 'u1', 'cat1c'));
    const v1 = await repo.findById('u1', 'sl1');
    const v2 = await repo.findById('u1', 'sl1');
    assert.ok(v1 && v2);
    await repo.save(v1);
    await assert.rejects(repo.save(v2), StaleDataError);
  });
}
