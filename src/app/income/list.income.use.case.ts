import { z } from 'zod';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { loadCategoryIndex } from '../category/category.index.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type IncomeRepository } from './income.repository.port.ts';
import { type TransactionRepository } from '../transaction/transaction.repository.port.ts';
import { listLaunchedIncomeMonths } from './list.launched.income.months.ts';
import { type IncomeWithLaunchStatus } from './income.with.launch.status.ts';
import { listIncomeInputSchema } from './list.income.input.schema.ts';
import { type AccountRepository } from '../account/account.repository.port.ts';

/**
 * Caso de uso "listar ganhos" (spec 002, RF-17). Isolamento por usuario e do repositorio
 * (RF-16). Enriquece cada `Income` com os meses ja lancados no Extrato (spec 012, RF-3/RF-6/
 * RF-10, Q4) - calculado a cada chamada, sem cache: a proxima listagem ja reflete uma
 * `Transaction` recem-lancada ou excluida, sem gatilho dedicado (decisao Q5 do plano).
 */
export class ListIncomesUseCase {
  private readonly incomes: IncomeRepository;
  private readonly categories: CategoryRepository;
  private readonly transactions: TransactionRepository;
  private readonly accounts: AccountRepository | undefined;

  public constructor(
    incomes: IncomeRepository,
    categories: CategoryRepository,
    transactions: TransactionRepository,
    accounts?: AccountRepository,
  ) {
    this.incomes = incomes;
    this.categories = categories;
    this.transactions = transactions;
    this.accounts = accounts;
  }

  public async execute(rawInput: unknown): Promise<IncomeWithLaunchStatus[]> {
    const parsed = listIncomeInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar ganhos', flat.fieldErrors, flat.formErrors);
    }

    const { userId } = parsed.data;
    const [rows, index, allTransactions, accounts] = await Promise.all([
      this.incomes.listByUser(userId),
      loadCategoryIndex(this.categories, userId),
      this.transactions.listByUser(userId),
      this.accounts?.listByUser(userId) ?? Promise.resolve([]),
    ]);
    const creditCardAccountIds = new Set(
      (accounts ?? [])
        .filter((account) => account.kind === 'credit-card')
        .map((account) => account.id),
    );
    const launchedIncomeIdsFromCreditCards = new Set(
      allTransactions
        .filter(
          (transaction) =>
            transaction.type === 'income' &&
            transaction.incomeId !== null &&
            creditCardAccountIds.has(transaction.accountId),
        )
        .map((transaction) => transaction.incomeId),
    );
    const legacyCardPaymentKeys = new Set(
      allTransactions
        .filter(
          (transaction) =>
            transaction.type === 'income' &&
            (transaction.cardPaymentGroupId !== null ||
              transaction.notes?.toLowerCase().includes('fatura') === true),
        )
        .map((transaction) => `${transaction.date.toISOString().slice(0, 10)}:${transaction.amount.cents}`),
    );

    return rows
      .map((row) => ({
        ...index.describe(row),
        launchedMonths: [...listLaunchedIncomeMonths(allTransactions, row.id)],
      }))
      .filter(
        (row) =>
          !row.isSystemCategory &&
          !row.isSystemTransfer &&
          !row.isSystemCardPayment &&
          !launchedIncomeIdsFromCreditCards.has(row.item.id) &&
          !legacyCardPaymentKeys.has(
            `${row.item.date.toISOString().slice(0, 10)}:${row.item.amount.cents}`,
          ),
      );
  }
}
