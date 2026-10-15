import { z } from 'zod';
import { SpendingLimitPlan } from '../../domain/spending-limit/spending.limit.plan.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { toRecurrence } from '../shared/to.recurrence.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type UserRepository } from '../user/user.repository.port.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { resolveCategoryId } from '../category/resolve.category.id.ts';
import { type SpendingLimitPlanRepository } from './spending.limit.plan.repository.port.ts';
import { registerSpendingLimitPlanInputSchema } from './register.spending.limit.plan.input.schema.ts';

/**
 * Caso de uso "registrar plano de limite de gasto" (spec 016, RF-1).
 *
 * Valida a entrada com zod, confirma usuario existente e verificado
 * (`UserNotFoundError`/`UserNotVerifiedError`, mesma regra de `RegisterIncomeUseCase`),
 * resolve a categoria e persiste a definicao recorrente. Nao cria nenhum `SpendingLimit`
 * concreto aqui - isso so acontece quando o usuario "aplica" um mes
 * (`ApplySpendingLimitMonthUseCase`).
 */
export class RegisterSpendingLimitPlanUseCase {
  private readonly plans: SpendingLimitPlanRepository;
  private readonly users: UserRepository;
  private readonly categories: CategoryRepository;
  private readonly ids: IdGenerator;

  public constructor(
    plans: SpendingLimitPlanRepository,
    users: UserRepository,
    categories: CategoryRepository,
    ids: IdGenerator,
  ) {
    this.plans = plans;
    this.users = users;
    this.categories = categories;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<SpendingLimitPlan> {
    const parsed = registerSpendingLimitPlanInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('registrar plano de limite de gasto', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (!user.isVerified()) {
      throw new UserNotVerifiedError();
    }

    const categoryId = await resolveCategoryId(this.categories, this.ids, input);
    const plan = SpendingLimitPlan.create({
      id: this.ids.next(),
      userId: input.userId,
      categoryId,
      maxAmount: Money.fromCents(input.maxAmountCents),
      recurrence: toRecurrence(input.recurrence),
      createdAt: new Date(),
    });

    await this.plans.save(plan);
    return plan;
  }
}
