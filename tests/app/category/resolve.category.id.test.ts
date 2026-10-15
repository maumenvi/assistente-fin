import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCategoryId } from '../../../src/app/category/resolve.category.id.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { CategoryNotFoundError } from '../../../src/domain/category/category.not.found.error.ts';
import { InvalidCategoryError } from '../../../src/domain/category/invalid.category.error.ts';
import { FakeCategoryRepository } from '../../../src/database/fake/category.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const setup = () => ({
  categories: new FakeCategoryRepository(),
  ids: new SequentialIdGenerator('cat'),
});

const seed = async (
  categories: FakeCategoryRepository,
  id: string,
  userId: string,
  name: string,
) => {
  await categories.save(Category.create({ id, userId, name: CategoryName.create(name) }));
};

test('categoryId do proprio usuario e devolvido como esta', async () => {
  const { categories, ids } = setup();
  await seed(categories, 'c1', 'u1', 'Mercado');

  const resolved = await resolveCategoryId(categories, ids, { userId: 'u1', categoryId: 'c1' });

  assert.equal(resolved, 'c1');
});

test('categoryId de outro usuario -> CategoryNotFoundError (CA-30)', async () => {
  const { categories, ids } = setup();
  await seed(categories, 'c1', 'u1', 'Mercado');

  await assert.rejects(
    resolveCategoryId(categories, ids, { userId: 'u2', categoryId: 'c1' }),
    CategoryNotFoundError,
  );
});

test('categoryId inexistente -> CategoryNotFoundError', async () => {
  const { categories, ids } = setup();

  await assert.rejects(
    resolveCategoryId(categories, ids, { userId: 'u1', categoryId: 'sumiu' }),
    CategoryNotFoundError,
  );
});

test('categoryName novo cria a categoria em MAIUSCULAS e vincula (CA-9)', async () => {
  const { categories, ids } = setup();

  const resolved = await resolveCategoryId(categories, ids, {
    userId: 'u1',
    categoryName: 'Mercado',
  });

  const created = await categories.findById('u1', resolved);
  assert.equal(created?.name.value, 'MERCADO');
  assert.equal(created?.isDefault, false, 'categoria digitada nasce comum, nao padrao');
});

test('categoryName existente em qualquer caixa reusa, sem duplicar (CA-10)', async () => {
  const { categories, ids } = setup();
  await seed(categories, 'c1', 'u1', 'Mercado');

  const byLower = await resolveCategoryId(categories, ids, {
    userId: 'u1',
    categoryName: 'mercado',
  });
  const byPadded = await resolveCategoryId(categories, ids, {
    userId: 'u1',
    categoryName: '  MeRcAdO  ',
  });

  assert.equal(byLower, 'c1');
  assert.equal(byPadded, 'c1');
  assert.equal((await categories.listByUser('u1')).length, 1);
});

test('categoryName de outro usuario nao e reusado - cria a do usuario atual', async () => {
  const { categories, ids } = setup();
  await seed(categories, 'c1', 'u1', 'Mercado');

  const resolved = await resolveCategoryId(categories, ids, {
    userId: 'u2',
    categoryName: 'Mercado',
  });

  assert.notEqual(resolved, 'c1');
  assert.equal((await categories.findById('u2', resolved))?.name.value, 'MERCADO');
});

test('sem id e sem nome -> categoria padrao, criando-a se faltar (CA-7)', async () => {
  const { categories, ids } = setup();

  const resolved = await resolveCategoryId(categories, ids, { userId: 'u1' });

  const fallback = await categories.findById('u1', resolved);
  assert.equal(fallback?.isDefault, true);
  assert.equal(fallback?.name.value, 'SEM CATEGORIA');
});

test('nome so com espacos cai na padrao, nao vira categoria vazia', async () => {
  const { categories, ids } = setup();

  const resolved = await resolveCategoryId(categories, ids, { userId: 'u1', categoryName: '   ' });

  assert.equal((await categories.findById('u1', resolved))?.isDefault, true);
});

test('categoryId tem precedencia sobre categoryName', async () => {
  const { categories, ids } = setup();
  await seed(categories, 'c1', 'u1', 'Mercado');
  await seed(categories, 'c2', 'u1', 'Transporte');

  const resolved = await resolveCategoryId(categories, ids, {
    userId: 'u1',
    categoryId: 'c1',
    categoryName: 'Transporte',
  });

  assert.equal(resolved, 'c1');
  assert.equal((await categories.listByUser('u1')).length, 2, 'nao criou nada novo');
});

test('nome acima de 50 caracteres -> InvalidCategoryError (CA-29)', async () => {
  const { categories, ids } = setup();

  await assert.rejects(
    resolveCategoryId(categories, ids, { userId: 'u1', categoryName: 'x'.repeat(51) }),
    InvalidCategoryError,
  );
  assert.deepEqual(await categories.listByUser('u1'), [], 'nada foi gravado');
});
