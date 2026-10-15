import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { type TransactionSeriesRepository } from '../../../src/app/transaction/transaction.series.repository.port.ts';
import { TransactionSeries } from '../../../src/domain/transaction/transaction.series.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { addUtcMonths } from '../../../src/domain/shared/add.utc.months.ts';

const anchor = (iso: string) => new Date(iso);

const seriesProps = (id: string, userId: string, anchorIso: string) => {
  const start = anchor(anchorIso);
  return {
    id,
    userId,
    accountId: 'acc1',
    type: 'expense' as const,
    amount: Money.fromCents(20_000),
    // categorias `cat1` (u1) e `cat2` (u2) vem de `seedFixtureCategories` (FK no Prisma)
    categoryId: userId === 'u1' ? 'cat1' : 'cat2',
    recurrence: Recurrence.create({ frequency: 'mensal', endDate: addUtcMonths(start, 6) }),
    anchorDate: start,
  };
};

const series = (id: string, userId: string, anchorIso: string): TransactionSeries =>
  TransactionSeries.create(seriesProps(id, userId, anchorIso));

/**
 * Suite de contrato do `TransactionSeriesRepository`.
 *
 * Reutilizavel: cada adaptador (fake e Prisma) chama esta funcao com uma fabrica que devolve
 * um repositorio limpo. Garante o mesmo comportamento observavel em qualquer banco
 * (001/CA-19, CA-20). Assume conta `acc1` e categorias `cat1`/`cat2` ja existentes (FKs no
 * adaptador Prisma).
 */
export function runTransactionSeriesRepositoryContract(
  label: string,
  createRepository: () => TransactionSeriesRepository,
): void {
  test(`${label}: save + findById dentro do escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(series('s1', 'u1', '2026-03-01T00:00:00.000Z'));

    const found = await repo.findById('u1', 's1');
    assert.equal(found?.amount.cents, 20_000);
    assert.equal(found?.recurrence.frequency, 'mensal');
    assert.equal(found?.anchorDate.toISOString(), '2026-03-01T00:00:00.000Z');
    assert.equal(await repo.findById('u1', 'inexistente'), null);
  });

  test(`${label}: findById nao vaza serie de outro usuario (CA-14)`, async () => {
    const repo = createRepository();
    await repo.save(series('s1', 'u1', '2026-03-01T00:00:00.000Z'));

    assert.equal(await repo.findById('u2', 's1'), null);
  });

  test(`${label}: save sobrescreve pelo id (ex.: prolongar)`, async () => {
    const repo = createRepository();
    await repo.save(series('s1', 'u1', '2026-03-01T00:00:00.000Z'));
    const stored = await repo.findById('u1', 's1');
    assert.ok(stored);
    // final atual = ancora + 6m; prolongar empurra +1 alcance (mensal = +12m) a partir dele
    await repo.save(stored.extend().series);

    const found = await repo.findById('u1', 's1');
    assert.equal(
      found?.recurrence.endDate?.toISOString(),
      addUtcMonths(anchor('2026-09-01T00:00:00.000Z'), 12).toISOString(),
    );
  });

  test(`${label}: listByUser filtra por usuario e ordena por anchorDate (mais recente primeiro)`, async () => {
    const repo = createRepository();
    await repo.save(series('s1', 'u1', '2026-01-01T00:00:00.000Z'));
    await repo.save(series('s2', 'u1', '2026-05-01T00:00:00.000Z'));
    await repo.save(series('s3', 'u2', '2026-06-01T00:00:00.000Z'));

    const ids = (await repo.listByUser('u1')).map((s) => s.id);
    assert.deepEqual(ids, ['s2', 's1']);
    assert.deepEqual(await repo.listByUser('u3'), []);
  });

  test(`${label}: save rejeita gravar sobre uma versao ja alterada (RF-31)`, async () => {
    const repo = createRepository();
    await repo.save(series('s1', 'u1', '2026-03-01T00:00:00.000Z'));
    const v1 = await repo.findById('u1', 's1');
    const v2 = await repo.findById('u1', 's1');
    assert.ok(v1 && v2);
    await repo.save(v1.extend().series);
    await assert.rejects(repo.save(v2.extend().series), StaleDataError);
  });

}
