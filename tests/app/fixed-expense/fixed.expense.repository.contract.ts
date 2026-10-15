import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { type FixedExpenseRepository } from '../../../src/app/fixed-expense/fixed.expense.repository.port.ts';
import { FixedExpense } from '../../../src/domain/fixed-expense/fixed.expense.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';

const fixedExpense = (
  id: string,
  userId: string,
  dueDay: number,
  categoryId: string,
): FixedExpense =>
  FixedExpense.create({
    id,
    userId,
    dueDay,
    expectedAmount: Money.fromCents(15_000),
    categoryId,
    accountId: 'acc1',
  });

/**
 * Suite de contrato do `FixedExpenseRepository`.
 *
 * Reutilizavel: cada adaptador (fake hoje, Prisma tambem) chama esta funcao com uma fabrica
 * que devolve um repositorio limpo. Garante o mesmo comportamento observavel em qualquer
 * banco (CA-19, CA-20). Assume uma conta `acc1` ja existente (FK no adaptador Prisma).
 */
export function runFixedExpenseRepositoryContract(
  label: string,
  createRepository: () => FixedExpenseRepository,
): void {
  test(`${label}: save + findById dentro do escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(fixedExpense('fe1', 'u1', 10, 'cat1'));

    const found = await repo.findById('u1', 'fe1');
    assert.equal(found?.categoryId, 'cat1');
    assert.equal(await repo.findById('u1', 'inexistente'), null);
  });

  test(`${label}: findById nao vaza gasto de outro usuario (CA-14)`, async () => {
    const repo = createRepository();
    await repo.save(fixedExpense('fe1', 'u1', 10, 'cat1'));

    assert.equal(await repo.findById('u2', 'fe1'), null);
  });

  test(`${label}: save sobrescreve pelo id (ex.: markAsPaid)`, async () => {
    const repo = createRepository();
    const expense = fixedExpense('fe1', 'u1', 10, 'cat1');
    await repo.save(expense);
    await repo.save(expense.markAsPaid());

    const found = await repo.findById('u1', 'fe1');
    assert.equal(found?.paid, true);
  });

  test(`${label}: listByUser filtra por usuario e ordena por dia de vencimento`, async () => {
    const repo = createRepository();
    await repo.save(fixedExpense('fe1', 'u1', 20, 'cat1'));
    await repo.save(fixedExpense('fe2', 'u1', 5, 'cat1b'));
    await repo.save(fixedExpense('fe3', 'u2', 1, 'cat2'));

    const dueDays = (await repo.listByUser('u1')).map((e) => e.dueDay);
    assert.deepEqual(dueDays, [5, 20]);
  });

  test(`${label}: delete respeita o escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(fixedExpense('fe1', 'u1', 10, 'cat1'));

    await repo.delete('u2', 'fe1');
    assert.ok(await repo.findById('u1', 'fe1'), 'nao remove gasto de outro usuario');

    await repo.delete('u1', 'fe1');
    assert.equal(await repo.findById('u1', 'fe1'), null);
    await repo.delete('u1', 'fe1'); // idempotente, nao lanca
  });

  test(`${label}: save rejeita gravar sobre uma versao ja alterada (RF-31)`, async () => {
    const repo = createRepository();
    await repo.save(fixedExpense('fe1', 'u1', 10, 'cat1'));
    const v1 = await repo.findById('u1', 'fe1');
    const v2 = await repo.findById('u1', 'fe1');
    assert.ok(v1 && v2);
    await repo.save(v1);
    await assert.rejects(repo.save(v2), StaleDataError);
  });
}
