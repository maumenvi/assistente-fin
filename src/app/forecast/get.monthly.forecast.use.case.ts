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
import { getMonthlyForecastInputSchema } from './get.monthly.forecast.input.schema.ts';
import { resolveCreditCardInvoicesForMonth } from './resolve.credit.card.invoices.for.month.ts';
import { resolveExcludedCategoryIds } from './resolve.excluded.category.ids.ts';

/**
 * Caso de uso "obter previsao do mes" (spec 001, RF-7, RF-8, CA-7).
 *
 * So leitura: nao exige usuario verificado (decisao 9 do plano - so criar dado financeiro
 * exige, ver `ListAccountsUseCase`). Busca o estado atual de ganhos/gastos fixos/limites/
 * transacoes e chama `calculateMonthlyForecast` (funcao pura) - "recalcular quando os dados
 * mudarem" (RF-8, CA-7) e automatico por construcao: nao ha previsao guardada pra
 * invalidar, cada chamada le o estado de novo.
 *
 * `excludedCategoryIds` (spec 016, RF-20) resolvido via `resolveExcludedCategoryIds` -
 * transferencias/pagamentos de fatura ficam fora do resultado operacional.
 *
 * `historicalExpenses`/`monthTransactions` excluem despesas de conta `kind: 'credit-card'`
 * (spec 018, RF-27a): sem essa exclusao, a mesma compra no cartao contaria duas vezes - uma
 * em `projectedCreditCardInvoices` (soma por conta-cartao, via
 * `resolveCreditCardInvoicesForMonth`) e outra na media movel/tendencia da categoria dela em
 * `estimatedNonFixedExpenses` (soma por categoria, sem filtro de conta). A fatura continua
 * contando exclusivamente via `projectedCreditCardInvoices`.
 */
export class GetMonthlyForecastUseCase {
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

  public async execute(rawInput: unknown): Promise<ForecastResult> {
    const parsed = getMonthlyForecastInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('obter previsao do mes', flat.fieldErrors, flat.formErrors);
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

    const targetMonth = Month.create(input.month);
    const creditCardInvoices = await resolveCreditCardInvoicesForMonth(
      input.userId,
      accounts,
      this.transactions,
      targetMonth,
    );

    // spec 018, RF-27a: despesa de conta-cartao ja conta via `creditCardInvoices` acima - sem
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

    return calculateMonthlyForecast({
      month: targetMonth,
      incomes: operationalIncomes,
      fixedExpenses,
      spendingLimits,
      // spec 021 (RF-61): transacao gerada por gasto fixo fica de fora - `fixedExpenses`
      // acima ja soma TODO gasto fixo em `projectedFixedExpenses`, entao deixa-la entrar
      // tambem pela media de categoria contaria o mesmo gasto duas vezes.
      historicalExpenses: allTransactions.filter(
        (transaction) =>
          transaction.type === 'expense' &&
          !isCreditCardAccount(transaction) &&
          !isFixedExpenseTransaction(transaction),
      ),
      // ocorrencias de recorrencia ja materializadas dentro do mes-alvo (spec 003, decisao 6)
      monthTransactions: allTransactions.filter(
        (transaction) =>
          Month.fromDate(transaction.date).equals(targetMonth) &&
          !isCreditCardAccount(transaction) &&
          !isFixedExpenseTransaction(transaction),
      ),
      windowMonths: input.windowMonths,
      // faturas de cartao de credito cujo vencimento cai no mes-alvo (spec 008, RF-6)
      creditCardInvoices,
      excludedCategoryIds,
    });
  }
}
