import { z } from 'zod';
import { type Category } from '../../domain/category/category.entity.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type CategoryRepository } from './category.repository.port.ts';
import { listCategoriesInputSchema } from './list.categories.input.schema.ts';

/**
 * Caso de uso "listar categorias" (spec 003, RF-6, CA-11). Isolamento por usuario e do
 * repositorio (001/RF-16). Alimenta tanto a tela de Categorias quanto o combobox dos
 * lancamentos.
 */
export class ListCategoriesUseCase {
  private readonly categories: CategoryRepository;

  public constructor(categories: CategoryRepository) {
    this.categories = categories;
  }

  public async execute(rawInput: unknown): Promise<Category[]> {
    const parsed = listCategoriesInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar categorias', flat.fieldErrors, flat.formErrors);
    }

    return this.categories.listByUser(parsed.data.userId);
  }
}
