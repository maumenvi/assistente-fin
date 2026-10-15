import { z } from 'zod';
import { SpendingLimitPlan } from '../../domain/spending-limit/spending.limit.plan.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { toRecurrence } from '../shared/to.recurrence.ts';
import { SpendingLimitPlanNotFoundError } from '../../domain/spending-limit/spending.limit.plan.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { resolveCategoryIdOrKeep } from '../category/resolve.category.id.or.keep.ts';
import { type SpendingLimitPlanRepository } from './spending.limit.plan.repository.port.ts';
import { updateSpendingLimitPlanInputSchema } from './update.spending.limit.plan.input.schema.ts';

/**
 * Caso de uso "atualizar plano de limite de gasto" (spec 016, RF-1).
 *
 * `SpendingLimitPlanNotFoundError` se nao existir no escopo do usuario. Reconstroi via
 * `SpendingLimitPlan.create` com o mesmo id e `createdAt` (a ancora do plano nunca muda -
 * mesmo principio de nao reancorar recorrencia ao editar), mesclando so os campos enviados.
 */
export class UpdateSpendingLimitPlanUseCase {
  private readonly plans: SpendingLimitPlanRepository;
  private readonly categories: CategoryRepository;
  private readonly ids: IdGenerator;

  public constructor(plans: SpendingLimitPlanRepository, categories: CategoryRepository, ids: IdGenerator) {
    this.plans = plans;
    this.categories = categories;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<SpendingLimitPlan> {
    const parsed = updateSpendingLimitPlanInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('atualizar plano de limite de gasto', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.plans.findById(input.userId, input.id);
    if (!existing) {
      throw new SpendingLimitPlanNotFoundError();
    }

    const expected =
      input.expectedUpdatedAt !== undefined ? new Date(input.expectedUpdatedAt) : existing.updatedAt;

    const categoryId = await resolveCategoryIdOrKeep(this.categories, this.ids, input, existing.categoryId);

    const updated = SpendingLimitPlan.create({
      id: existing.id,
      userId: existing.userId,
      categoryId,
      maxAmount: input.maxAmountCents !== undefined ? Money.fromCents(input.maxAmountCents) : existing.maxAmount,
      recurrence: input.recurrence !== undefined ? toRecurrence(input.recurrence) : existing.recurrence,
      createdAt: existing.createdAt,
    }).withUpdatedAt(expected);

    await this.plans.save(updated);
    return (await this.plans.findById(input.userId, input.id)) ?? updated;
  }
}
