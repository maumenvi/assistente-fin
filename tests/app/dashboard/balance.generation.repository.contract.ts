import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type BalanceGenerationRepository } from '../../../src/app/dashboard/balance.generation.repository.port.ts';

/**
 * Suite de contrato do `BalanceGenerationRepository`.
 *
 * Reutilizavel: cada adaptador (fake hoje, Postgres/Prisma) chama esta funcao com uma fabrica
 * que devolve um repositorio limpo. Garante o mesmo comportamento observavel em qualquer
 * backend (spec 011, decisao 4.9).
 */
export function runBalanceGenerationRepositoryContract(
  label: string,
  createRepository: () => BalanceGenerationRepository,
): void {
  test(`${label}: existsFor comeca false ate markGenerated`, async () => {
    const repo = createRepository();

    assert.equal(await repo.existsFor('u1', 2026, 9), false);

    await repo.markGenerated('u1', 2026, 9);

    assert.equal(await repo.existsFor('u1', 2026, 9), true);
  });

  test(`${label}: markGenerated e idempotente`, async () => {
    const repo = createRepository();

    await repo.markGenerated('u1', 2026, 9);
    await repo.markGenerated('u1', 2026, 9);

    assert.equal(await repo.existsFor('u1', 2026, 9), true);
  });

  test(`${label}: isolado por usuario`, async () => {
    const repo = createRepository();

    await repo.markGenerated('u1', 2026, 9);

    assert.equal(await repo.existsFor('u2', 2026, 9), false);
  });

  test(`${label}: isolado por mes/ano`, async () => {
    const repo = createRepository();

    await repo.markGenerated('u1', 2026, 9);

    assert.equal(await repo.existsFor('u1', 2026, 8), false);
    assert.equal(await repo.existsFor('u1', 2025, 9), false);
  });
}
