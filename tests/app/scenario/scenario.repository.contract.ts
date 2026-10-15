import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { type ScenarioRepository } from '../../../src/app/scenario/scenario.repository.port.ts';
import { ProjectionScenario } from '../../../src/domain/scenario/projection.scenario.entity.ts';
import { ScenarioAdjustment } from '../../../src/domain/scenario/scenario.adjustment.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

const adjustment = (): ScenarioAdjustment =>
  ScenarioAdjustment.create({
    target: 'income',
    mode: 'add',
    label: 'Bico',
    amountCents: 100_000,
    from: Month.create({ year: 2026, month: 3 }),
    to: Month.create({ year: 2026, month: 6 }),
  });

const scenario = (id: string, userId: string, name: string): ProjectionScenario =>
  ProjectionScenario.create({
    id,
    userId,
    name,
    adjustments: [adjustment()],
    horizonMonths: 12,
  });

/**
 * Suite de contrato do `ScenarioRepository` (spec 002, RF-34..RF-36, RF-31). Reutilizavel:
 * cada adaptador (fake, Prisma) chama com uma fabrica de repositorio limpo (CA-19, CA-20).
 */
export function runScenarioRepositoryContract(
  label: string,
  createRepository: () => ScenarioRepository,
): void {
  test(`${label}: save + findById dentro do escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(scenario('scn1', 'u1', 'Mudanca'));

    const found = await repo.findById('u1', 'scn1');
    assert.equal(found?.name, 'Mudanca');
    assert.equal(found?.adjustments.length, 1);
    assert.equal(found?.adjustments[0]?.amountCents, 100_000);
    assert.equal(await repo.findById('u1', 'inexistente'), null);
  });

  test(`${label}: findById nao vaza cenario de outro usuario`, async () => {
    const repo = createRepository();
    await repo.save(scenario('scn1', 'u1', 'Mudanca'));

    assert.equal(await repo.findById('u2', 'scn1'), null);
  });

  test(`${label}: listByUser filtra por usuario e ordena por nome`, async () => {
    const repo = createRepository();
    await repo.save(scenario('scn1', 'u1', 'Zulu'));
    await repo.save(scenario('scn2', 'u1', 'Alfa'));
    await repo.save(scenario('scn3', 'u2', 'Outro'));

    const names = (await repo.listByUser('u1')).map((s) => s.name);
    assert.deepEqual(names, ['Alfa', 'Zulu']);
  });

  test(`${label}: delete respeita o escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(scenario('scn1', 'u1', 'Mudanca'));

    await repo.delete('u2', 'scn1');
    assert.ok(await repo.findById('u1', 'scn1'), 'nao remove cenario de outro usuario');

    await repo.delete('u1', 'scn1');
    assert.equal(await repo.findById('u1', 'scn1'), null);
    await repo.delete('u1', 'scn1'); // idempotente
  });

  test(`${label}: save rejeita gravar sobre uma versao ja alterada (RF-31)`, async () => {
    const repo = createRepository();
    await repo.save(scenario('scn1', 'u1', 'Mudanca'));
    const v1 = await repo.findById('u1', 'scn1');
    const v2 = await repo.findById('u1', 'scn1');
    assert.ok(v1 && v2);
    await repo.save(v1);
    await assert.rejects(repo.save(v2), StaleDataError);
  });
}
