import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { type IncomeRepository } from '../../../src/app/income/income.repository.port.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';

const baseProps = (id: string, userId: string, date: string, source: string) => ({
  id,
  userId,
  date: new Date(date),
  amount: Money.fromCents(100_000),
  source,
  recurrence: Recurrence.none(),
  // categorias `cat1` (u1) e `cat2` (u2) vem de `seedFixtureCategories` (FK no Prisma)
  categoryId: userId === 'u1' ? 'cat1' : 'cat2',
});

const income = (id: string, userId: string, date: string, source: string): Income =>
  Income.create(baseProps(id, userId, date, source));

/**
 * Suite de contrato do `IncomeRepository`.
 *
 * Reutilizavel: cada adaptador (fake hoje, Prisma tambem) chama esta funcao com uma fabrica
 * que devolve um repositorio limpo. Garante o mesmo comportamento observavel em qualquer
 * banco (CA-19, CA-20).
 */
export function runIncomeRepositoryContract(
  label: string,
  createRepository: () => IncomeRepository,
): void {
  test(`${label}: save + findById dentro do escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(income('i1', 'u1', '2026-01-05T00:00:00.000Z', 'Salario'));

    const found = await repo.findById('u1', 'i1');
    assert.equal(found?.source, 'Salario');
    assert.equal(await repo.findById('u1', 'inexistente'), null);
  });

  test(`${label}: findById nao vaza ganho de outro usuario (CA-14)`, async () => {
    const repo = createRepository();
    await repo.save(income('i1', 'u1', '2026-01-05T00:00:00.000Z', 'Salario'));

    assert.equal(await repo.findById('u2', 'i1'), null);
  });

  test(`${label}: save sobrescreve pelo id`, async () => {
    const repo = createRepository();
    await repo.save(income('i1', 'u1', '2026-01-05T00:00:00.000Z', 'Salario'));
    await repo.save(income('i1', 'u1', '2026-01-05T00:00:00.000Z', 'Salario Novo'));

    const all = await repo.listByUser('u1');
    assert.equal(all.length, 1);
    assert.equal(all[0]?.source, 'Salario Novo');
  });

  test(`${label}: listByUser filtra por usuario e ordena por data (mais recente primeiro)`, async () => {
    const repo = createRepository();
    await repo.save(income('i1', 'u1', '2026-01-01T00:00:00.000Z', 'Antigo'));
    await repo.save(income('i2', 'u1', '2026-01-10T00:00:00.000Z', 'Recente'));
    await repo.save(income('i3', 'u2', '2026-01-15T00:00:00.000Z', 'Outro'));

    const sources = (await repo.listByUser('u1')).map((i) => i.source);
    assert.deepEqual(sources, ['Recente', 'Antigo']);
  });

  test(`${label}: delete respeita o escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(income('i1', 'u1', '2026-01-05T00:00:00.000Z', 'Salario'));

    await repo.delete('u2', 'i1');
    assert.ok(await repo.findById('u1', 'i1'), 'nao remove ganho de outro usuario');

    await repo.delete('u1', 'i1');
    assert.equal(await repo.findById('u1', 'i1'), null);
    await repo.delete('u1', 'i1'); // idempotente, nao lanca
  });

  test(`${label}: save rejeita gravar sobre uma versao ja alterada (RF-31)`, async () => {
    const repo = createRepository();
    await repo.save(income('i1', 'u1', '2026-01-05T00:00:00.000Z', 'Salario'));
    const v1 = await repo.findById('u1', 'i1');
    const v2 = await repo.findById('u1', 'i1');
    assert.ok(v1 && v2);
    await repo.save(v1);
    await assert.rejects(repo.save(v2), StaleDataError);
  });

  test(`${label}: round-trip de accountId (spec 012, RF-1)`, async () => {
    const repo = createRepository();
    const withLink = Income.create({
      ...baseProps('i1', 'u1', '2026-01-05T00:00:00.000Z', 'Salario'),
      accountId: 'acc1',
    });
    await repo.save(withLink);

    const found = await repo.findById('u1', 'i1');
    assert.equal(found?.accountId, 'acc1');
  });

  test(`${label}: accountId default para null quando ausente (RF-4, RF-13)`, async () => {
    const repo = createRepository();
    await repo.save(income('i1', 'u1', '2026-01-05T00:00:00.000Z', 'Salario'));

    const found = await repo.findById('u1', 'i1');
    assert.equal(found?.accountId, null);
  });
}
