import { z } from 'zod';
import { SpendingLimit } from '../../domain/spending-limit/spending.limit.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { Month } from '../../domain/shared/month.value.object.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type UserRepository } from '../user/user.repository.port.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { resolveCategoryId } from '../category/resolve.category.id.ts';
import { type SpendingLimitRepository } from './spending.limit.repository.port.ts';
import { setSpendingLimitInputSchema } from './set.spending.limit.input.schema.ts';

/**
 * Caso de uso "definir limite de gasto" (spec 001, RF-4, CA-4).
 *
 * Valida a entrada com zod, confirma usuario existente e verificado
 * (`UserNotFoundError`/`UserNotVerifiedError` - RF-15, RF-28, mesma regra de
 * `CreateAccount`), gera o id pela porta injetada, constroi a entidade e persiste. O status
 * (`ok|at-risk|exceeded`) nao e calculado aqui - ver `domain/spending-limit/limit.status.ts`.
 */
export class SetSpendingLimitUseCase {
  private readonly spendingLimits: SpendingLimitRepository;
  private readonly users: UserRepository;
  private readonly categories: CategoryRepository;
  private readonly ids: IdGenerator;

  public constructor(
    spendingLimits: SpendingLimitRepository,
    users: UserRepository,
    categories: CategoryRepository,
    ids: IdGenerator,
  ) {
    this.spendingLimits = spendingLimits;
    this.users = users;
    this.categories = categories;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<SpendingLimit> {
    const parsed = setSpendingLimitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('definir limite de gasto', flat.fieldErrors, flat.formErrors);
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

    const spendingLimit = SpendingLimit.create({
      id: this.ids.next(),
      userId: input.userId,
      categoryId,
      period: Month.create(input.period),
      maxAmount: Money.fromCents(input.maxAmountCents),
    });

    await this.spendingLimits.save(spendingLimit);
    return spendingLimit;
  }
}
