import { z } from 'zod';
import { type SpendingLimitPlan } from '../../domain/spending-limit/spending.limit.plan.entity.ts';
import { SpendingLimitPlanNotFoundError } from '../../domain/spending-limit/spending.limit.plan.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type SpendingLimitPlanRepository } from './spending.limit.plan.repository.port.ts';
import { deleteSpendingLimitPlanInputSchema } from './delete.spending.limit.plan.input.schema.ts';

/**
 * Caso de uso "excluir plano de limite de gasto" (spec 016). Busca no escopo do usuario
 * antes de remover pra devolver `SpendingLimitPlanNotFoundError`. Nao remove os
 * `SpendingLimit` ja aplicados a partir deste plano - a FK `definitionId` e `SET NULL`, entao
 * eles continuam existindo, so perdem o vinculo com o plano de origem.
 */
export class DeleteSpendingLimitPlanUseCase {
  private readonly plans: SpendingLimitPlanRepository;

  public constructor(plans: SpendingLimitPlanRepository) {
    this.plans = plans;
  }

  public async execute(rawInput: unknown): Promise<SpendingLimitPlan> {
    const parsed = deleteSpendingLimitPlanInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('excluir plano de limite de gasto', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.plans.findById(input.userId, input.id);
    if (!existing) {
      throw new SpendingLimitPlanNotFoundError();
    }

    await this.plans.delete(input.userId, input.id);
    return existing;
  }
}
