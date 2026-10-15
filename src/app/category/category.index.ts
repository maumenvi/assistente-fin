import { type CategoryRepository } from './category.repository.port.ts';
import { type WithCategory } from './with.category.ts';

/**
 * Indice das categorias de um usuario, carregado de uma vez para as listagens (spec 003,
 * RF-14) - evita uma consulta por linha listada.
 */
export interface CategoryIndex {
  /** Anexa nome e "pendente" a um lancamento, a partir do `categoryId` dele. */
  describe<T extends { readonly categoryId: string }>(item: T): WithCategory<T>;
}

/**
 * Carrega as categorias do usuario e devolve o indice.
 *
 * Um `categoryId` sem categoria correspondente vira nome vazio em vez de erro: a FK do banco
 * impede esse estado, e derrubar a listagem inteira por causa de uma linha seria pior que
 * mostrar o resto. `pendingClassification` compara com a padrao - se o usuario nao tiver
 * nenhuma marcada, nada e pendente.
 */
export async function loadCategoryIndex(
  categories: CategoryRepository,
  userId: string,
): Promise<CategoryIndex> {
  const all = await categories.listByUser(userId);
  const byId = new Map(all.map((category) => [category.id, category]));
  const defaultId = all.find((category) => category.isDefault)?.id;

  return {
    describe: (item) => {
      const category = byId.get(item.categoryId);
      return {
        item,
        categoryName: category?.name.value ?? '',
        pendingClassification: item.categoryId === defaultId,
        isSystemCategory:
          (category?.isSystemOpeningBalance ?? false) ||
          (category?.isSystemAdjustment ?? false) ||
          (category?.isSystemBalance ?? false),
        isSystemTransfer: category?.isSystemTransfer ?? false,
        isSystemCardPayment: category?.isSystemCardPayment ?? false,
      };
    },
  };
}
