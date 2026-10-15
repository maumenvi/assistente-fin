import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCategoryIndex } from '../../../src/app/category/category.index.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { FakeCategoryRepository } from '../../../src/database/fake/category.repository.fake.ts';

test('describe: categoria com isSystemTransfer reflete no item descrito (spec 018, RF-23)', async () => {
  const categories = new FakeCategoryRepository();
  await categories.save(
    Category.create({
      id: 'cat-transfer',
      userId: 'u1',
      name: CategoryName.create('TRANSFERÊNCIAS'),
      isSystemTransfer: true,
    }),
  );

  const index = await loadCategoryIndex(categories, 'u1');
  const described = index.describe({ categoryId: 'cat-transfer' });

  assert.equal(described.isSystemTransfer, true);
  assert.equal(described.isSystemCardPayment, false);
});

test('describe: categoria com isSystemCardPayment reflete no item descrito (spec 018, RF-23)', async () => {
  const categories = new FakeCategoryRepository();
  await categories.save(
    Category.create({
      id: 'cat-card',
      userId: 'u1',
      name: CategoryName.create('PAGAMENTO DE FATURA'),
      isSystemCardPayment: true,
    }),
  );

  const index = await loadCategoryIndex(categories, 'u1');
  const described = index.describe({ categoryId: 'cat-card' });

  assert.equal(described.isSystemCardPayment, true);
  assert.equal(described.isSystemTransfer, false);
});

test('describe: categoria comum, sem nenhuma flag de sistema -> ambas false', async () => {
  const categories = new FakeCategoryRepository();
  await categories.save(
    Category.create({ id: 'cat-comum', userId: 'u1', name: CategoryName.create('MERCADO') }),
  );

  const index = await loadCategoryIndex(categories, 'u1');
  const described = index.describe({ categoryId: 'cat-comum' });

  assert.equal(described.isSystemTransfer, false);
  assert.equal(described.isSystemCardPayment, false);
});

test('describe: categoryId sem categoria correspondente -> ambas false, sem lancar', async () => {
  const categories = new FakeCategoryRepository();
  const index = await loadCategoryIndex(categories, 'u1');

  const described = index.describe({ categoryId: 'inexistente' });

  assert.equal(described.isSystemTransfer, false);
  assert.equal(described.isSystemCardPayment, false);
});
