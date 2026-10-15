import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type CategoryRepository } from './category.repository.port.ts';
import { type CategorySelection, resolveCategoryId } from './resolve.category.id.ts';

/**
 * Versao de `resolveCategoryId` para os casos de uso de **edicao** (spec 003, RF-11).
 *
 * A diferenca esta no "nao informou nada": ao registrar isso significa "use a padrao" (CA-7),
 * ao editar significa "nao mexa na categoria". Sem essa distincao, salvar um formulario de
 * edicao sem tocar no campo jogaria o lancamento de volta para a padrao - ou seja, editar o
 * valor de um gasto o marcaria como pendente de classificacao.
 */
export async function resolveCategoryIdOrKeep(
  categories: CategoryRepository,
  ids: IdGenerator,
  selection: CategorySelection,
  current: string,
): Promise<string> {
  if (selection.categoryId === undefined && selection.categoryName === undefined) {
    return current;
  }
  return resolveCategoryId(categories, ids, selection);
}
