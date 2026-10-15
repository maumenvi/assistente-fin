import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ListCategoriesUseCase } from '../../../src/app/category/list.categories.use.case.ts';
import { ensureDefaultCategory } from '../../../src/app/category/ensure.default.category.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { FakeCategoryRepository } from '../../../src/database/fake/category.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const setup = () => {
  const categories = new FakeCategoryRepository();
  return { categories, useCase: new ListCategoriesUseCase(categories) };
};

test('lista as categorias do usuario ordenadas por nome, incluindo a padrao', async () => {
  const { categories, useCase } = setup();
  await ensureDefaultCategory(categories, new SequentialIdGenerator('cat'), 'u1');
  await categories.save(
    Category.create({ id: 'c1', userId: 'u1', name: CategoryName.create('Mercado') }),
  );
  await categories.save(
    Category.create({ id: 'c2', userId: 'u1', name: CategoryName.create('Aluguel') }),
  );

  const listed = await useCase.execute({ userId: 'u1' });

  assert.deepEqual(
    listed.map((c) => c.name.value),
    ['ALUGUEL', 'MERCADO', 'SEM CATEGORIA'],
  );
  assert.equal(listed.filter((c) => c.isDefault).length, 1);
});

test('nao vaza categoria de outro usuario (001/RF-16)', async () => {
  const { categories, useCase } = setup();
  await categories.save(
    Category.create({ id: 'c1', userId: 'u1', name: CategoryName.create('Mercado') }),
  );

  assert.deepEqual(await useCase.execute({ userId: 'u2' }), []);
});

test('entrada invalida -> InvalidInputError', async () => {
  const { useCase } = setup();

  await assert.rejects(useCase.execute({ userId: '' }), InvalidInputError);
  await assert.rejects(useCase.execute({}), InvalidInputError);
});
