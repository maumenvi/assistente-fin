import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ListSpendingLimitsUseCase } from '../../../src/app/spending-limit/list.spending.limit.use.case.ts';
import { UpdateSpendingLimitUseCase } from '../../../src/app/spending-limit/update.spending.limit.use.case.ts';
import { DeleteSpendingLimitUseCase } from '../../../src/app/spending-limit/delete.spending.limit.use.case.ts';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { SpendingLimitNotFoundError } from '../../../src/domain/spending-limit/spending.limit.not.found.error.ts';
import { SpendingLimit } from '../../../src/domain/spending-limit/spending.limit.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';
import { FakeSpendingLimitRepository } from '../../../src/database/fake/spending.limit.repository.fake.ts';
import { fakeCategories, DEFAULT_CATEGORY_ID } from '../../support/fake.categories.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const sl = (id: string, userId: string) =>
  SpendingLimit.create({
    id,
    userId,
    categoryId: 'cat-mercado',
    period: Month.create({ year: 2026, month: 1 }),
    maxAmount: Money.fromCents(50_000),
  });

const setup = async () => {
  const repo = new FakeSpendingLimitRepository();
  const categories = fakeCategories('u1', { 'cat-mercado': 'Mercado' });
  const ids = new SequentialIdGenerator('cat');
  await repo.save(sl('s1', 'u1'));
  await repo.save(sl('s2', 'u2'));
  return {
    repo,
    categories,
    list: new ListSpendingLimitsUseCase(repo, categories),
    update: new UpdateSpendingLimitUseCase(repo, categories, ids),
    del: new DeleteSpendingLimitUseCase(repo),
  };
};

test('list filtra por usuario', async () => {
  const { list } = await setup();
  assert.deepEqual((await list.execute({ userId: 'u1' })).map((r) => r.item.id), ['s1']);
});

test('update mescla campos', async () => {
  const { repo, update } = await setup();
  const updated = await update.execute({ userId: 'u1', id: 's1', maxAmountCents: 80_000 });
  assert.equal(updated.maxAmount.cents, 80_000);
  assert.equal(updated.categoryId, 'cat-mercado', 'preservado');
  assert.equal((await repo.findById('u1', 's1'))?.maxAmount.cents, 80_000);
});

test('update com expectedUpdatedAt desatualizado vira StaleDataError (RF-31)', async () => {
  const { repo, update } = await setup();
  const seenAt = (await repo.findById('u1', 's1'))!.updatedAt!.toISOString();
  await update.execute({ userId: 'u1', id: 's1', maxAmountCents: 60_000, expectedUpdatedAt: seenAt });
  await assert.rejects(
    update.execute({ userId: 'u1', id: 's1', maxAmountCents: 70_000, expectedUpdatedAt: seenAt }),
    StaleDataError,
  );
});

test('operacoes em limite de outro usuario viram SpendingLimitNotFoundError', async () => {
  const { update, del } = await setup();
  await assert.rejects(update.execute({ userId: 'u1', id: 's2', maxAmountCents: 1 }), SpendingLimitNotFoundError);
  await assert.rejects(del.execute({ userId: 'u1', id: 's2' }), SpendingLimitNotFoundError);
});

test('delete remove e devolve', async () => {
  const { repo, del } = await setup();
  assert.equal((await del.execute({ userId: 'u1', id: 's1' })).id, 's1');
  assert.equal(await repo.findById('u1', 's1'), null);
});
