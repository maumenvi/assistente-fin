import { Category } from '../../domain/category/category.entity.ts';
import { CategoryName } from '../../domain/category/category.name.value.object.ts';
import { DEFAULT_CATEGORY_NAME } from '../../domain/category/default.category.name.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type CategoryRepository } from './category.repository.port.ts';

/**
 * Devolve a categoria padrao do usuario, criando-a se ainda nao existir (spec 003, RF-8,
 * CA-5).
 *
 * Idempotente: chamada duas vezes devolve a mesma categoria, sem criar uma segunda. Quem
 * procura e `findDefault` (flag `isDefault`), nao o nome - a padrao pode ter sido renomeada
 * pelo usuario (CA-6) e ainda assim e ela que recebe os lancamentos sem categoria.
 *
 * A criacao normal acontece junto com a do usuario (tarefa 2.6); esta funcao e tambem a rede
 * de seguranca para usuarios que, por qualquer caminho, tenham ficado sem a padrao. Nesse
 * caminho de excecao ela assume que o nome padrao esta livre - o que vale porque a padrao
 * nasce com o usuario e nao pode ser excluida (RF-7); se nao valesse, o `UNIQUE (user_id,
 * name)` do banco recusaria a insercao em vez de duplicar silenciosamente.
 */
export async function ensureDefaultCategory(
  categories: CategoryRepository,
  ids: IdGenerator,
  userId: string,
): Promise<Category> {
  const existing = await categories.findDefault(userId);
  if (existing) {
    return existing;
  }

  const created = Category.create({
    id: ids.next(),
    userId,
    name: CategoryName.create(DEFAULT_CATEGORY_NAME),
    isDefault: true,
  });
  await categories.save(created);
  return created;
}
