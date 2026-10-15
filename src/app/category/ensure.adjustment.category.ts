import { Category } from '../../domain/category/category.entity.ts';
import { CategoryName } from '../../domain/category/category.name.value.object.ts';
import { ADJUSTMENT_CATEGORY_NAME } from '../../domain/category/adjustment.category.name.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type CategoryRepository } from './category.repository.port.ts';

/**
 * Devolve a categoria de sistema "AJUSTE" do usuario, criando-a se ainda nao existir (spec
 * 015).
 *
 * Idempotente: chamada duas vezes devolve a mesma categoria, sem criar uma segunda. Quem
 * procura e `findSystemAdjustment` (flag `isSystemAdjustment`), nao o nome - mesmo padrao de
 * `ensureBalanceCategory`.
 */
export async function ensureAdjustmentCategory(
  categories: CategoryRepository,
  ids: IdGenerator,
  userId: string,
): Promise<Category> {
  const existing = await categories.findSystemAdjustment(userId);
  if (existing) {
    return existing;
  }

  const created = Category.create({
    id: ids.next(),
    userId,
    name: CategoryName.create(ADJUSTMENT_CATEGORY_NAME),
    isSystemAdjustment: true,
  });
  await categories.save(created);
  return created;
}
