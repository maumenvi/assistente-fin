import { type ListAccountsUseCase } from '../../../account/list.account.use.case.ts';
import { type ListCategoriesUseCase } from '../../../category/list.categories.use.case.ts';
import { type CalculateCreditCardAvailableLimitUseCase } from '../../../credit-card/calculate.credit.card.available.limit.use.case.ts';
import { type CalculateCreditCardCommittedBalanceUseCase } from '../../../credit-card/calculate.credit.card.committed.balance.use.case.ts';
import { type CalculateCreditCardInvoiceUseCase } from '../../../credit-card/calculate.credit.card.invoice.use.case.ts';
import { type ListFixedExpensesUseCase } from '../../../fixed-expense/list.fixed.expense.use.case.ts';
import { type GetForecastRangeUseCase } from '../../../forecast/get.forecast.range.use.case.ts';
import { type GetMonthlyForecastUseCase } from '../../../forecast/get.monthly.forecast.use.case.ts';
import { type ListIncomesUseCase } from '../../../income/list.income.use.case.ts';
import { type ListSpendingLimitsWithUsageUseCase } from '../../../spending-limit/list.spending.limits.with.usage.use.case.ts';
import { type ListTransactionsUseCase } from '../../../transaction/list.transaction.use.case.ts';

/**
 * Casos de uso de CONSULTA que as ferramentas do agente usam (spec 031). O `Container` do app
 * satisfaz esta forma sem conversao; so `execute` e exigido (ferramentas nunca escrevem).
 */
export interface AgentToolDeps {
  readonly listAccounts: Pick<ListAccountsUseCase, 'execute'>;
  readonly listCategories: Pick<ListCategoriesUseCase, 'execute'>;
  readonly listTransactions: Pick<ListTransactionsUseCase, 'execute'>;
  readonly listIncomes: Pick<ListIncomesUseCase, 'execute'>;
  readonly listFixedExpenses: Pick<ListFixedExpensesUseCase, 'execute'>;
  readonly listSpendingLimitsWithUsage: Pick<ListSpendingLimitsWithUsageUseCase, 'execute'>;
  readonly getMonthlyForecast: Pick<GetMonthlyForecastUseCase, 'execute'>;
  readonly getForecastRange: Pick<GetForecastRangeUseCase, 'execute'>;
  readonly calculateCreditCardInvoice: Pick<CalculateCreditCardInvoiceUseCase, 'execute'>;
  readonly calculateCreditCardAvailableLimit: Pick<CalculateCreditCardAvailableLimitUseCase, 'execute'>;
  readonly calculateCreditCardCommittedBalance: Pick<CalculateCreditCardCommittedBalanceUseCase, 'execute'>;
}
