import { Category } from '../../domain/category/category.entity.ts';
import { CategoryName } from '../../domain/category/category.name.value.object.ts';
import { OPENING_BALANCE_CATEGORY_NAME } from '../../domain/category/opening.balance.category.name.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type CategoryRepository } from './category.repository.port.ts';

/**
 * Devolve a categoria de sistema "SALDO INICIAL" do usuario, criando-a se ainda nao existir
 * (spec 015).
 *
 * Idempotente: chamada duas vezes devolve a mesma categoria, sem criar uma segunda. Quem
 * procura e `findSystemOpeningBalance` (flag `isSystemOpeningBalance`), nao o nome - mesmo
 * padrao de `ensureBalanceCategory`.
 */
export async function ensureOpeningBalanceCategory(
  categories: CategoryRepository,
  ids: IdGenerator,
  userId: string,
): Promise<Category> {
  const existing = await categories.findSystemOpeningBalance(userId);
  if (existing) {
    return existing;
  }

  const created = Category.create({
    id: ids.next(),
    userId,
    name: CategoryName.create(OPENING_BALANCE_CATEGORY_NAME),
    isSystemOpeningBalance: true,
  });
  await categories.save(created);
  return created;
}
