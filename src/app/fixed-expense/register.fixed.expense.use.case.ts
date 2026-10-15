import { z } from 'zod';
import { FixedExpense } from '../../domain/fixed-expense/fixed.expense.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type UserRepository } from '../user/user.repository.port.ts';
import { type AccountRepository } from '../account/account.repository.port.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { resolveCategoryId } from '../category/resolve.category.id.ts';
import { type FixedExpenseRepository } from './fixed.expense.repository.port.ts';
import { registerFixedExpenseInputSchema } from './register.fixed.expense.input.schema.ts';

/**
 * Caso de uso "registrar gasto fixo" (spec 001, RF-3, CA-3).
 *
 * Valida a entrada com zod, confirma usuario existente e verificado
 * (`UserNotFoundError`/`UserNotVerifiedError` - RF-15, RF-28, mesma regra de `CreateAccount`)
 * e que `accountId` pertence a esse usuario (`AccountNotFoundError` senao - RF-16), gera o
 * id pela porta injetada, constroi a entidade e persiste.
 */
export class RegisterFixedExpenseUseCase {
  private readonly fixedExpenses: FixedExpenseRepository;
  private readonly users: UserRepository;
  private readonly accounts: AccountRepository;
  private readonly categories: CategoryRepository;
  private readonly ids: IdGenerator;

  public constructor(
    fixedExpenses: FixedExpenseRepository,
    users: UserRepository,
    accounts: AccountRepository,
    categories: CategoryRepository,
    ids: IdGenerator,
  ) {
    this.fixedExpenses = fixedExpenses;
    this.users = users;
    this.accounts = accounts;
    this.categories = categories;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<FixedExpense> {
    const parsed = registerFixedExpenseInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('registrar gasto fixo', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (!user.isVerified()) {
      throw new UserNotVerifiedError();
    }
    const account = await this.accounts.findById(input.userId, input.accountId);
    if (!account) {
      throw new AccountNotFoundError();
    }

    const categoryId = await resolveCategoryId(this.categories, this.ids, input);

    const fixedExpense = FixedExpense.create({
      id: this.ids.next(),
      userId: input.userId,
      dueDay: input.dueDay,
      referenceMonth: input.referenceMonth,
      description: input.description,
      expectedAmount: Money.fromCents(input.expectedAmountCents),
      categoryId,
      accountId: input.accountId,
    });

    await this.fixedExpenses.save(fixedExpense);
    return fixedExpense;
  }
}
