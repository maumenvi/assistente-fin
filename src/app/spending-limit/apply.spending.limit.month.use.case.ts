import { z } from 'zod';
import { SpendingLimit } from '../../domain/spending-limit/spending.limit.entity.ts';
import { Month } from '../../domain/shared/month.value.object.ts';
import { SpendingLimitPlanNotFoundError } from '../../domain/spending-limit/spending.limit.plan.not.found.error.ts';
import { SpendingLimitMonthAlreadyAppliedError } from '../../domain/spending-limit/spending.limit.month.already.applied.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type SpendingLimitPlanRepository } from './spending.limit.plan.repository.port.ts';
import { type SpendingLimitRepository } from './spending.limit.repository.port.ts';
import { listAppliedSpendingLimitMonths } from './list.applied.spending.limit.months.ts';
import { applySpendingLimitMonthInputSchema } from './apply.spending.limit.month.input.schema.ts';

/**
 * Caso de uso "aplicar o mes de um plano de limite de gasto" (spec 016).
 *
 * Cria um `SpendingLimit` concreto (mesmo `categoryId`/`maxAmount` do plano, `period` = mes
 * pedido) vinculado ao plano de origem via `definitionId`. Idempotente por mes: se o mes
 * pedido ja tem um `SpendingLimit` vinculado aquele plano, rejeita com
 * `SpendingLimitMonthAlreadyAppliedError` sem criar nada. Equivalente a
 * `LaunchIncomeMonthUseCase`, mas sem materializar nenhuma `Transaction` - o teto do mes e o
 * proprio `SpendingLimit`, o gasto/status continuam calculados a parte
 * (`ListSpendingLimitsWithUsageUseCase`) a partir das despesas reais.
 */
export class ApplySpendingLimitMonthUseCase {
  private readonly plans: SpendingLimitPlanRepository;
  private readonly spendingLimits: SpendingLimitRepository;
  private readonly ids: IdGenerator;

  public constructor(
    plans: SpendingLimitPlanRepository,
    spendingLimits: SpendingLimitRepository,
    ids: IdGenerator,
  ) {
    this.plans = plans;
    this.spendingLimits = spendingLimits;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<SpendingLimit> {
    const parsed = applySpendingLimitMonthInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('aplicar mes do plano de limite', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const plan = await this.plans.findById(input.userId, input.planId);
    if (!plan) {
      throw new SpendingLimitPlanNotFoundError();
    }

    const targetMonth = Month.create(input.month);
    const existingLimits = await this.spendingLimits.listByUser(input.userId);
    const applied = listAppliedSpendingLimitMonths(existingLimits, plan.id);
    if (applied.has(targetMonth.toString())) {
      throw new SpendingLimitMonthAlreadyAppliedError();
    }

    const spendingLimit = SpendingLimit.create({
      id: this.ids.next(),
      userId: input.userId,
      categoryId: plan.categoryId,
      period: targetMonth,
      maxAmount: plan.maxAmount,
      definitionId: plan.id,
    });
    await this.spendingLimits.save(spendingLimit);
    return spendingLimit;
  }
}
