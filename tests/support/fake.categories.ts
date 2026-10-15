import { Category } from '../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../src/domain/category/category.name.value.object.ts';
import { DEFAULT_CATEGORY_NAME } from '../../src/domain/category/default.category.name.ts';
import { type CategoryRepository } from '../../src/app/category/category.repository.port.ts';
import { FakeCategoryRepository } from '../../src/database/fake/category.repository.fake.ts';

/** Id da categoria padrao criada por `fakeCategories` - o destino de quem nao informa nada. */
export const DEFAULT_CATEGORY_ID = 'cat-default';

/**
 * `FakeCategoryRepository` ja com a categoria padrao do usuario (spec 003, RF-8) e, opcional,
 * outras nomeadas: `fakeCategories('u1', { 'cat-1': 'Trabalho' })`.
 *
 * Quase todo caso de uso de lancamento depende de existir uma padrao - sem ela,
 * `resolveCategoryId` criaria uma na hora e o teste passaria a depender do gerador de ids.
 */
export function fakeCategories(
  userId: string,
  named: Readonly<Record<string, string>> = {},
): FakeCategoryRepository {
  const categories = new FakeCategoryRepository();
  void seedDefaultCategory(categories, userId);
  for (const [id, name] of Object.entries(named)) {
    void categories.save(Category.create({ id, userId, name: CategoryName.create(name) }));
  }
  return categories;
}

/**
 * Grava a categoria padrao (`DEFAULT_CATEGORY_ID`) de um usuario num repositorio ja existente
 * - para os testes que precisam da padrao mas montam o proprio `FakeDatabase`.
 */
export async function seedDefaultCategory(
  categories: CategoryRepository,
  userId: string,
): Promise<void> {
  await categories.save(
    Category.create({
      id: DEFAULT_CATEGORY_ID,
      userId,
      name: CategoryName.create(DEFAULT_CATEGORY_NAME),
      isDefault: true,
    }),
  );
}
