import { z } from 'zod';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { loadCategoryIndex } from '../category/category.index.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type SpendingLimitPlanRepository } from './spending.limit.plan.repository.port.ts';
import { type SpendingLimitRepository } from './spending.limit.repository.port.ts';
import { listAppliedSpendingLimitMonths } from './list.applied.spending.limit.months.ts';
import { type SpendingLimitPlanWithApplyStatus } from './spending.limit.plan.with.apply.status.ts';
import { listSpendingLimitPlanInputSchema } from './list.spending.limit.plan.input.schema.ts';

/**
 * Caso de uso "listar planos de limite de gasto" (spec 016). Isolamento por usuario e do
 * repositorio. Enriquece cada `SpendingLimitPlan` com os meses ja aplicados
 * (`listAppliedSpendingLimitMonths`) - calculado a cada chamada, sem cache, mesmo padrao de
 * `ListIncomesUseCase`.
 */
export class ListSpendingLimitPlansUseCase {
  private readonly plans: SpendingLimitPlanRepository;
  private readonly categories: CategoryRepository;
  private readonly spendingLimits: SpendingLimitRepository;

  public constructor(
    plans: SpendingLimitPlanRepository,
    categories: CategoryRepository,
    spendingLimits: SpendingLimitRepository,
  ) {
    this.plans = plans;
    this.categories = categories;
    this.spendingLimits = spendingLimits;
  }

  public async execute(rawInput: unknown): Promise<SpendingLimitPlanWithApplyStatus[]> {
    const parsed = listSpendingLimitPlanInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar planos de limite de gasto', flat.fieldErrors, flat.formErrors);
    }

    const { userId } = parsed.data;
    const [rows, index, allLimits] = await Promise.all([
      this.plans.listByUser(userId),
      loadCategoryIndex(this.categories, userId),
      this.spendingLimits.listByUser(userId),
    ]);

    return rows.map((row) => ({
      ...index.describe(row),
      appliedMonths: [...listAppliedSpendingLimitMonths(allLimits, row.id)],
    }));
  }
}
