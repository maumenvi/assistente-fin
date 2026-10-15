import { Category } from '../../domain/category/category.entity.ts';
import { CategoryName } from '../../domain/category/category.name.value.object.ts';
import { TRANSFER_CATEGORY_NAME } from '../../domain/category/transfer.category.name.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type CategoryRepository } from './category.repository.port.ts';

/**
 * Devolve a categoria de sistema de transferencia entre contas do usuario, criando-a se
 * ainda nao existir (spec 016, RF-1).
 *
 * Idempotente: chamada duas vezes devolve a mesma categoria, sem criar uma segunda. Quem
 * procura primeiro e `findSystemTransfer` (flag `isSystemTransfer`) - mesmo padrao de
 * `ensureAdjustmentCategory`.
 *
 * Antes de criar, tambem busca por nome (`findByName` com `TRANSFER_CATEGORY_NAME`
 * normalizado): se o usuario ja tem uma categoria "TRANSFERÊNCIAS" pre-existente (criada
 * manualmente, antes desta spec) mas ainda sem a flag, promove ela mesma em vez de tentar
 * criar uma segunda com o mesmo nome - o `@@unique([userId, name])` do Postgres rejeitaria
 * essa segunda categoria com um erro de constraint que nao e um `DomainError`, e sem este
 * fallback toda chamada de `transaction.transfer` numa instalacao com a categoria manual ja
 * existente falhava com `INTERNAL` (mesmo bug que `MigrateTransferCategoryUseCase`/RF-10
 * resolve fora do fluxo automatico - aqui e o caminho que roda sozinho, sob demanda).
 */
export async function ensureTransferCategory(
  categories: CategoryRepository,
  ids: IdGenerator,
  userId: string,
): Promise<Category> {
  const existing = await categories.findSystemTransfer(userId);
  if (existing) {
    return existing;
  }

  const homonym = await categories.findByName(userId, CategoryName.create(TRANSFER_CATEGORY_NAME));
  if (homonym) {
    const promoted = homonym.withSystemTransfer();
    await categories.save(promoted);
    return promoted;
  }

  const created = Category.create({
    id: ids.next(),
    userId,
    name: CategoryName.create(TRANSFER_CATEGORY_NAME),
    isSystemTransfer: true,
  });
  await categories.save(created);
  return created;
}
