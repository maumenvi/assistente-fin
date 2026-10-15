import { type DashboardTransaction } from './dashboard.transaction.ts';
import { type DashboardAccount } from './dashboard.account.ts';
import { type DashboardFixedExpense } from './dashboard.fixed.expense.ts';
import { type DashboardMonthSummary } from './dashboard.month.summary.ts';
import { groupTransactionsByCategory } from './group.transactions.by.category.ts';
import { sumBenefitTransactions } from './sum.benefit.transactions.ts';
import { sumFixedExpensesByCategory } from './sum.fixed.expenses.by.category.ts';
import { computeTotalAvailableBalance } from './compute.total.available.balance.ts';

/**
 * Resume o mes do Dashboard (spec 022: a mesma conta do desktop, agora compartilhada). Gastos
 * = lancamentos do mes por categoria + gastos fixos pelo valor esperado, pagos ou nao
 * (spec 021, RF-57/RF-59); ganhos por categoria; resultado = ganhos - gastos.
 */
export function summarizeDashboardMonth(
  transactions: readonly DashboardTransaction[],
  accounts: readonly DashboardAccount[],
  fixedExpenses: readonly DashboardFixedExpense[],
  month: { readonly year: number; readonly month: number },
): DashboardMonthSummary {
  const incomeByCategory = groupTransactionsByCategory(transactions, accounts, month, 'income');
  const totalIncomeCents = incomeByCategory.reduce((sum, row) => sum + row.totalCents, 0);
  const expenseByCategory = sumFixedExpensesByCategory(
    fixedExpenses,
    groupTransactionsByCategory(transactions, accounts, month, 'expense'),
  );
  const totalExpenseCents = expenseByCategory.reduce((sum, row) => sum + row.totalCents, 0);
  return {
    incomeByCategory,
    totalIncomeCents,
    benefitIncomeCents: sumBenefitTransactions(transactions, accounts, month, 'income'),
    expenseByCategory,
    totalExpenseCents,
    balanceCents: totalIncomeCents - totalExpenseCents,
    totalAvailableBalanceCents: computeTotalAvailableBalance(transactions, accounts),
  };
}
