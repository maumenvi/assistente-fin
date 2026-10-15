import { z } from 'zod';
import { Category } from '../../domain/category/category.entity.ts';
import { CategoryName } from '../../domain/category/category.name.value.object.ts';
import { DuplicateCategoryError } from '../../domain/category/duplicate.category.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type CategoryRepository } from './category.repository.port.ts';
import { createCategoryInputSchema } from './create.category.input.schema.ts';

/**
 * Caso de uso "criar categoria" (spec 003, RF-6, CA-1, CA-2).
 *
 * Normaliza o nome no dominio e recusa com `DuplicateCategoryError` quando o usuario ja tem
 * uma categoria com esse nome normalizado - diferente de `resolveCategoryId`, que reusa a
 * existente (CA-10): la o usuario esta lancando um gasto, aqui esta pedindo uma categoria
 * nova, e criar a segunda "MERCADO" nao e o que ele quis.
 *
 * A categoria criada aqui nasce sempre comum (`isDefault: false`): a padrao e criada com o
 * usuario (tarefa 2.6) e nao ha promocao.
 */
export class CreateCategoryUseCase {
  private readonly categories: CategoryRepository;
  private readonly ids: IdGenerator;

  public constructor(categories: CategoryRepository, ids: IdGenerator) {
    this.categories = categories;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<Category> {
    const parsed = createCategoryInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('criar categoria', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const name = CategoryName.create(input.name);
    if (await this.categories.findByName(input.userId, name)) {
      throw new DuplicateCategoryError(name.value);
    }

    const category = Category.create({ id: this.ids.next(), userId: input.userId, name });
    await this.categories.save(category);
    return category;
  }
}
