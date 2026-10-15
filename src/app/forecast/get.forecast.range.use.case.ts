import { z } from 'zod';
import { Month } from '../../domain/shared/month.value.object.ts';
import { isFixedExpenseTransaction } from '../../domain/transaction/is.fixed.expense.transaction.ts';
import { calculateMonthlyForecast, type ForecastResult } from '../../domain/forecast/monthly.forecast.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type UserRepository } from '../user/user.repository.port.ts';
import { type IncomeRepository } from '../income/income.repository.port.ts';
import { type FixedExpenseRepository } from '../fixed-expense/fixed.expense.repository.port.ts';
import { type SpendingLimitRepository } from '../spending-limit/spending.limit.repository.port.ts';
import { type TransactionRepository } from '../transaction/transaction.repository.port.ts';
import { type AccountRepository } from '../account/account.repository.port.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { getForecastRangeInputSchema } from './get.forecast.range.input.schema.ts';
import { resolveCreditCardInvoicesForMonth } from './resolve.credit.card.invoices.for.month.ts';
import { resolveExcludedCategoryIds } from './resolve.excluded.category.ids.ts';

/**
 * Caso de uso "previsao de varios meses seguidos" (spec 002, design.md 6.4).
 *
 * So leitura (nao exige usuario verificado - decisao 9). Carrega o estado do usuario UMA vez
 * e roda `calculateMonthlyForecast` (funcao pura) por mes do intervalo - o Dashboard mostra
 * 12 meses no grafico sem 12 idas ao banco. "Recalcular quando os dados mudarem" (RF-8,
 * CA-7) e automatico: nada e guardado, cada chamada le tudo de novo.
 *
 * `excludedCategoryIds` (spec 016, RF-20) resolvido uma vez para todo o intervalo (mesma
 * filosofia de carregar o estado do usuario uma unica vez).
 *
 * `historicalExpenses`/`monthTransactions` excluem despesas de conta `kind: 'credit-card'`
 * (spec 018, RF-27a) - mesma exclusao de `GetMonthlyForecastUseCase`, evita a mesma compra no
 * cartao contar duas vezes (via `creditCardInvoices` e via media movel de categoria).
 */
export class GetForecastRangeUseCase {
  private readonly users: UserRepository;
  private readonly incomes: IncomeRepository;
  private readonly fixedExpenses: FixedExpenseRepository;
  private readonly spendingLimits: SpendingLimitRepository;
  private readonly transactions: TransactionRepository;
  private readonly accounts: AccountRepository;
  private readonly categories: CategoryRepository;

  public constructor(
    users: UserRepository,
    incomes: IncomeRepository,
    fixedExpenses: FixedExpenseRepository,
    spendingLimits: SpendingLimitRepository,
    transactions: TransactionRepository,
    accounts: AccountRepository,
    categories: CategoryRepository,
  ) {
    this.users = users;
    this.incomes = incomes;
    this.fixedExpenses = fixedExpenses;
    this.spendingLimits = spendingLimits;
    this.transactions = transactions;
    this.accounts = accounts;
    this.categories = categories;
  }

  public async execute(rawInput: unknown): Promise<ForecastResult[]> {
    const parsed = getForecastRangeInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('obter previsao do periodo', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const [incomes, fixedExpenses, spendingLimits, allTransactions, accounts, excludedCategoryIds] =
      await Promise.all([
        this.incomes.listByUser(input.userId),
        this.fixedExpenses.listByUser(input.userId),
        this.spendingLimits.listByUser(input.userId),
        this.transactions.listByUser(input.userId),
        this.accounts.listByUser(input.userId),
        resolveExcludedCategoryIds(this.categories, input.userId),
      ]);
    // spec 018, RF-27a: despesa de conta-cartao ja conta via `creditCardInvoices` abaixo - sem
    // este filtro, contaria de novo na media movel/tendencia da categoria dela.
    const creditCardAccountIds = new Set(
      accounts.filter((account) => account.kind === 'credit-card').map((account) => account.id),
    );
    const isCreditCardAccount = (transaction: { readonly accountId: string }) =>
      creditCardAccountIds.has(transaction.accountId);
    const launchedIncomeIdsFromCreditCards = new Set(
      allTransactions
        .filter(
          (transaction) =>
            transaction.type === 'income' &&
            transaction.incomeId !== null &&
            isCreditCardAccount(transaction),
        )
        .map((transaction) => transaction.incomeId),
    );
    const legacyCardPaymentKeys = new Set(
      allTransactions
        .filter(
          (transaction) =>
            transaction.type === 'income' &&
            excludedCategoryIds.has(transaction.categoryId) &&
            (transaction.cardPaymentGroupId !== null ||
              transaction.notes?.toLowerCase().includes('fatura') === true),
        )
        .map((transaction) => `${transaction.date.toISOString().slice(0, 10)}:${transaction.amount.cents}`),
    );
    const operationalIncomes = incomes.filter(
      (income) =>
        !excludedCategoryIds.has(income.categoryId) &&
        !launchedIncomeIdsFromCreditCards.has(income.id) &&
        !legacyCardPaymentKeys.has(`${income.date.toISOString().slice(0, 10)}:${income.amount.cents}`),
    );
    // spec 021 (RF-61): mesma exclusao de `GetMonthlyForecastUseCase` - transacao gerada por
    // gasto fixo nao entra na media de categoria, porque `projectedFixedExpenses` ja soma o
    // gasto fixo inteiro.
    const historicalExpenses = allTransactions.filter(
      (transaction) =>
        transaction.type === 'expense' &&
        !isCreditCardAccount(transaction) &&
        !isFixedExpenseTransaction(transaction),
    );

    const result: ForecastResult[] = [];
    let month = Month.create(input.from);
    for (let i = 0; i < input.months; i += 1) {
      const creditCardInvoices = await resolveCreditCardInvoicesForMonth(
        input.userId,
        accounts,
        this.transactions,
        month,
      );
      result.push(
        calculateMonthlyForecast({
          month,
          incomes: operationalIncomes,
          fixedExpenses,
          spendingLimits,
          historicalExpenses,
          monthTransactions: allTransactions.filter(
            (transaction) =>
              Month.fromDate(transaction.date).equals(month) &&
              !isCreditCardAccount(transaction) &&
              !isFixedExpenseTransaction(transaction),
          ),
          windowMonths: input.windowMonths,
          creditCardInvoices,
          excludedCategoryIds,
        }),
      );
      month = month.next();
    }
    return result;
  }
}
