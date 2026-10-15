import { Category } from '../../domain/category/category.entity.ts';
import { CategoryName } from '../../domain/category/category.name.value.object.ts';
import { BALANCE_CATEGORY_NAME } from '../../domain/category/balance.category.name.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type CategoryRepository } from './category.repository.port.ts';

/**
 * Devolve a categoria de sistema "SALDO" do usuario, criando-a se ainda nao existir (spec
 * 011, RF-16).
 *
 * Idempotente: chamada duas vezes devolve a mesma categoria, sem criar uma segunda. Quem
 * procura e `findSystemBalance` (flag `isSystemBalance`), nao o nome - a categoria pode ter
 * sido renomeada pelo usuario e ainda assim e ela que recebe o lancamento automatico de saldo
 * do mes anterior (mesmo padrao de `ensureDefaultCategory`).
 */
export async function ensureBalanceCategory(
  categories: CategoryRepository,
  ids: IdGenerator,
  userId: string,
): Promise<Category> {
  const existing = await categories.findSystemBalance(userId);
  if (existing) {
    return existing;
  }

  const created = Category.create({
    id: ids.next(),
    userId,
    name: CategoryName.create(BALANCE_CATEGORY_NAME),
    isSystemBalance: true,
  });
  await categories.save(created);
  return created;
}
