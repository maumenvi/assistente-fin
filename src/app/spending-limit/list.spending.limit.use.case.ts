import { z } from 'zod';
import { type SpendingLimit } from '../../domain/spending-limit/spending.limit.entity.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { loadCategoryIndex } from '../category/category.index.ts';
import { type WithCategory } from '../category/with.category.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type SpendingLimitRepository } from './spending.limit.repository.port.ts';
import { listSpendingLimitInputSchema } from './list.spending.limit.input.schema.ts';

/** Caso de uso "listar limites de gasto" (spec 002, RF-19). Isolamento por usuario e do repositorio (RF-16). */
export class ListSpendingLimitsUseCase {
  private readonly spendingLimits: SpendingLimitRepository;
  private readonly categories: CategoryRepository;

  public constructor(spendingLimits: SpendingLimitRepository, categories: CategoryRepository) {
    this.spendingLimits = spendingLimits;
    this.categories = categories;
  }

  public async execute(rawInput: unknown): Promise<WithCategory<SpendingLimit>[]> {
    const parsed = listSpendingLimitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar limites de gasto', flat.fieldErrors, flat.formErrors);
    }

    const { userId } = parsed.data;
    const [rows, index] = await Promise.all([
      this.spendingLimits.listByUser(userId),
      loadCategoryIndex(this.categories, userId),
    ]);

    return rows.map((row) => index.describe(row));
  }
}
