import { z } from 'zod';
import { type Category } from '../../domain/category/category.entity.ts';
import { CategoryName } from '../../domain/category/category.name.value.object.ts';
import { CategoryNotFoundError } from '../../domain/category/category.not.found.error.ts';
import { DuplicateCategoryError } from '../../domain/category/duplicate.category.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type CategoryRepository } from './category.repository.port.ts';
import { renameCategoryInputSchema } from './rename.category.input.schema.ts';

/**
 * Caso de uso "renomear categoria" (spec 003, RF-6, CA-3, CA-6).
 *
 * O `id` nao muda, entao a mudanca propaga sozinha para todo lancamento vinculado - nao ha
 * atualizacao em massa a fazer. Renomear a categoria padrao e permitido e ela continua sendo
 * a padrao (CA-6). Renomear para um nome que o usuario ja tem e recusado
 * (`DuplicateCategoryError`); renomear para o mesmo nome que ela ja tem e no-op valido.
 *
 * Carrega `expectedUpdatedAt` (a versao que a borda leu) via `withUpdatedAt` - o `save`
 * compara com o banco e lanca `StaleDataError` se mudou (RF-31).
 */
export class RenameCategoryUseCase {
  private readonly categories: CategoryRepository;

  public constructor(categories: CategoryRepository) {
    this.categories = categories;
  }

  public async execute(rawInput: unknown): Promise<Category> {
    const parsed = renameCategoryInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('renomear categoria', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.categories.findById(input.userId, input.id);
    if (!existing) {
      throw new CategoryNotFoundError();
    }

    const name = CategoryName.create(input.name);
    const clash = await this.categories.findByName(input.userId, name);
    if (clash && clash.id !== existing.id) {
      throw new DuplicateCategoryError(name.value);
    }

    const expected =
      input.expectedUpdatedAt !== undefined
        ? new Date(input.expectedUpdatedAt)
        : existing.updatedAt;

    await this.categories.save(existing.rename(name).withUpdatedAt(expected));
    // rele a versao persistida: `save` recarimba o `updatedAt` (RF-31) e quem chama precisa
    // do valor real, nao do que acabamos de enviar.
    return (await this.categories.findById(input.userId, input.id)) ?? existing.rename(name);
  }
}
