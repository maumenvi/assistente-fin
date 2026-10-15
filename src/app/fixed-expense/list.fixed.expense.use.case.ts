import { z } from 'zod';
import { type FixedExpense } from '../../domain/fixed-expense/fixed.expense.entity.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { loadCategoryIndex } from '../category/category.index.ts';
import { type WithCategory } from '../category/with.category.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type FixedExpenseRepository } from './fixed.expense.repository.port.ts';
import { listFixedExpenseInputSchema } from './list.fixed.expense.input.schema.ts';

/** Caso de uso "listar gastos fixos" (spec 002, RF-18). Isolamento por usuario e do repositorio (RF-16). */
export class ListFixedExpensesUseCase {
  private readonly fixedExpenses: FixedExpenseRepository;
  private readonly categories: CategoryRepository;

  public constructor(fixedExpenses: FixedExpenseRepository, categories: CategoryRepository) {
    this.fixedExpenses = fixedExpenses;
    this.categories = categories;
  }

  public async execute(rawInput: unknown): Promise<WithCategory<FixedExpense>[]> {
    const parsed = listFixedExpenseInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar gastos fixos', flat.fieldErrors, flat.formErrors);
    }

    const { userId } = parsed.data;
    const [rows, index] = await Promise.all([
      this.fixedExpenses.listByUser(userId),
      loadCategoryIndex(this.categories, userId),
    ]);

    return rows.map((row) => index.describe(row));
  }
}
