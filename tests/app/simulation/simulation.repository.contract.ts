import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { type SimulationRepository } from '../../../src/app/simulation/simulation.repository.port.ts';
import { PurchaseSimulation } from '../../../src/domain/simulation/simulation.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';

const simulation = (id: string, userId: string, amountCents: number): PurchaseSimulation =>
  PurchaseSimulation.create({
    id,
    userId,
    amount: Money.fromCents(amountCents),
    date: new Date('2026-01-05T10:00:00.000Z'),
    // categorias `cat1` (u1) e `cat2` (u2) vem de `seedFixtureCategories` (FK no Prisma)
    categoryId: userId === 'u1' ? 'cat1' : 'cat2',
    payment: 'credit-card',
    installments: 1,
    recurrence: Recurrence.none(),
    accountId: 'acc1',
  });

/**
 * Suite de contrato do `SimulationRepository`.
 *
 * Reutilizavel: cada adaptador (fake hoje, Prisma tambem) chama esta funcao com uma fabrica
 * que devolve um repositorio limpo. Garante o mesmo comportamento observavel em qualquer
 * banco (CA-19, CA-20). Assume uma conta `acc1` ja existente (FK no adaptador Prisma).
 */
export function runSimulationRepositoryContract(
  label: string,
  createRepository: () => SimulationRepository,
): void {
  test(`${label}: save + findById dentro do escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(simulation('s1', 'u1', 5_000));

    const found = await repo.findById('u1', 's1');
    assert.equal(found?.amount.cents, 5_000);
    assert.equal(await repo.findById('u1', 'inexistente'), null);
  });

  test(`${label}: findById nao vaza simulacao de outro usuario (CA-14)`, async () => {
    const repo = createRepository();
    await repo.save(simulation('s1', 'u1', 5_000));

    assert.equal(await repo.findById('u2', 's1'), null);
  });

  test(`${label}: save sobrescreve pelo id (ex.: approve)`, async () => {
    const repo = createRepository();
    const original = simulation('s1', 'u1', 5_000);
    await repo.save(original);
    await repo.save(original.approve(new Date('2026-01-06T00:00:00.000Z')));

    const found = await repo.findById('u1', 's1');
    assert.ok(found?.approvedAt);
  });

  test(`${label}: listByUser filtra por usuario`, async () => {
    const repo = createRepository();
    await repo.save(simulation('s1', 'u1', 1_000));
    await repo.save(simulation('s2', 'u1', 2_000));
    await repo.save(simulation('s3', 'u2', 3_000));

    const amounts = (await repo.listByUser('u1')).map((s) => s.amount.cents).sort();
    assert.deepEqual(amounts, [1_000, 2_000]);
  });

  test(`${label}: save rejeita gravar sobre uma versao ja alterada (RF-31)`, async () => {
    const repo = createRepository();
    await repo.save(simulation('s1', 'u1', 5_000));
    const v1 = await repo.findById('u1', 's1');
    const v2 = await repo.findById('u1', 's1');
    assert.ok(v1 && v2);
    await repo.save(v1);
    await assert.rejects(repo.save(v2), StaleDataError);
  });
}
