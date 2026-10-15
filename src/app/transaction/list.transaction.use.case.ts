import { z } from 'zod';
import { type Transaction } from '../../domain/transaction/transaction.entity.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { loadCategoryIndex } from '../category/category.index.ts';
import { type WithCategory } from '../category/with.category.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type TransactionRepository } from './transaction.repository.port.ts';
import { listTransactionInputSchema } from './list.transaction.input.schema.ts';

/**
 * Caso de uso "listar transacoes" (spec 002, RF-20). O repositorio ja ordena por data (mais
 * recente primeiro) e isola por usuario (RF-16).
 */
export class ListTransactionsUseCase {
  private readonly transactions: TransactionRepository;
  private readonly categories: CategoryRepository;

  public constructor(transactions: TransactionRepository, categories: CategoryRepository) {
    this.transactions = transactions;
    this.categories = categories;
  }

  public async execute(rawInput: unknown): Promise<WithCategory<Transaction>[]> {
    const parsed = listTransactionInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar transacoes', flat.fieldErrors, flat.formErrors);
    }

    const { userId } = parsed.data;
    const [rows, index] = await Promise.all([
      this.transactions.listByUser(userId),
      loadCategoryIndex(this.categories, userId),
    ]);

    return rows.map((row) => index.describe(row));
  }
}
