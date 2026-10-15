import { z } from 'zod';
import { FixedExpense } from '../../domain/fixed-expense/fixed.expense.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { FixedExpenseNotFoundError } from '../../domain/fixed-expense/fixed.expense.not.found.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type AccountRepository } from '../account/account.repository.port.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { resolveCategoryIdOrKeep } from '../category/resolve.category.id.or.keep.ts';
import { type FixedExpenseRepository } from './fixed.expense.repository.port.ts';
import { updateFixedExpenseInputSchema } from './update.fixed.expense.input.schema.ts';

/**
 * Caso de uso "atualizar gasto fixo" (spec 002, RF-18, RF-31).
 *
 * `FixedExpenseNotFoundError` fora do escopo do usuario (CA-14). Reconstroi via
 * `FixedExpense.fromPersistence` (preserva `paid` e carrega o `updatedAt` esperado -
 * `expectedUpdatedAt` da borda ou a versao lida agora), mesclando so os campos enviados.
 * Nao exige verificacao (editar != criar, decisao 9 do plano da 001). `accountId`, quando
 * enviado, move o gasto fixo pra outra conta do mesmo usuario (`AccountNotFoundError` senao).
 */
export class UpdateFixedExpenseUseCase {
  private readonly fixedExpenses: FixedExpenseRepository;
  private readonly accounts: AccountRepository;
  private readonly categories: CategoryRepository;
  private readonly ids: IdGenerator;

  public constructor(
    fixedExpenses: FixedExpenseRepository,
    accounts: AccountRepository,
    categories: CategoryRepository,
    ids: IdGenerator,
  ) {
    this.fixedExpenses = fixedExpenses;
    this.accounts = accounts;
    this.categories = categories;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<FixedExpense> {
    const parsed = updateFixedExpenseInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('atualizar gasto fixo', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.fixedExpenses.findById(input.userId, input.id);
    if (!existing) {
      throw new FixedExpenseNotFoundError();
    }

    let accountId = existing.accountId;
    if (input.accountId !== undefined) {
      const account = await this.accounts.findById(input.userId, input.accountId);
      if (!account) {
        throw new AccountNotFoundError();
      }
      accountId = account.id;
    }

    const categoryId = await resolveCategoryIdOrKeep(
      this.categories,
      this.ids,
      input,
      existing.categoryId,
    );

    const updated = FixedExpense.fromPersistence({
      id: existing.id,
      userId: existing.userId,
      dueDay: input.dueDay ?? existing.dueDay,
      referenceMonth: input.referenceMonth ?? existing.referenceMonth,
      description: input.description ?? existing.description,
      expectedAmount:
        input.expectedAmountCents !== undefined
          ? Money.fromCents(input.expectedAmountCents)
          : existing.expectedAmount,
      categoryId,
      accountId,
      paid: existing.paid,
      updatedAt:
        input.expectedUpdatedAt !== undefined
          ? new Date(input.expectedUpdatedAt)
          : existing.updatedAt,
    });

    await this.fixedExpenses.save(updated);
    // rele a versao persistida: `save` recarimba o `updatedAt` (RF-31).
    return (await this.fixedExpenses.findById(input.userId, input.id)) ?? updated;
  }
}
