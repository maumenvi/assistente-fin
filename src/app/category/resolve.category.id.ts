import { Category } from '../../domain/category/category.entity.ts';
import { CategoryName } from '../../domain/category/category.name.value.object.ts';
import { CategoryNotFoundError } from '../../domain/category/category.not.found.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type CategoryRepository } from './category.repository.port.ts';
import { ensureDefaultCategory } from './ensure.default.category.ts';

/**
 * Como o lancamento indicou a categoria: por id (escolhida numa lista), por nome (digitada)
 * ou por nada (cai na padrao). Os dois campos sao opcionais e o id tem precedencia.
 */
export interface CategorySelection {
  readonly userId: string;
  readonly categoryId?: string | undefined;
  readonly categoryName?: string | undefined;
}

/**
 * Traduz a escolha de categoria de um lancamento no `categoryId` que sera gravado
 * (spec 003, RF-11..RF-13).
 *
 * - `categoryId`: confere que a categoria e do proprio usuario, senao `CategoryNotFoundError`
 *   (CA-30). Tem precedencia sobre o nome - quem escolheu na lista ja disse qual e.
 * - `categoryName`: normaliza e reusa a categoria existente com esse nome, em qualquer caixa
 *   (CA-10); cria uma nova so quando nao houver (CA-9). Digitar nome repetido nunca e erro
 *   aqui - so no CRUD de categorias (`DuplicateCategoryError`).
 * - nada: cai na categoria padrao, o que deixa o lancamento "pendente de classificacao"
 *   (CA-7, RF-14).
 */
export async function resolveCategoryId(
  categories: CategoryRepository,
  ids: IdGenerator,
  selection: CategorySelection,
): Promise<string> {
  if (selection.categoryId !== undefined && selection.categoryId !== '') {
    const found = await categories.findById(selection.userId, selection.categoryId);
    if (!found) {
      throw new CategoryNotFoundError();
    }
    return found.id;
  }

  if (selection.categoryName !== undefined && selection.categoryName.trim() !== '') {
    const name = CategoryName.create(selection.categoryName);
    const existing = await categories.findByName(selection.userId, name);
    if (existing) {
      return existing.id;
    }
    const created = Category.create({ id: ids.next(), userId: selection.userId, name });
    await categories.save(created);
    return created.id;
  }

  return (await ensureDefaultCategory(categories, ids, selection.userId)).id;
}
