import { type TransactionType } from '../../domain/transaction/transaction.type.ts';
import { type DashboardTransaction } from './dashboard.transaction.ts';
import { type DashboardAccount } from './dashboard.account.ts';
import { isInMonth } from './is.in.month.ts';

/** Soma consolidada de `transactions` do tipo `type`, de contas com `isBenefit: true`, no mes. */
export function sumBenefitTransactions(
  transactions: readonly DashboardTransaction[],
  accounts: readonly DashboardAccount[],
  month: { year: number; month: number },
  type: TransactionType,
): number {
  const benefitAccountIds = new Set(
    accounts.filter((account) => account.isBenefit).map((account) => account.id),
  );
  return transactions
    .filter((tx) => tx.type === type && isInMonth(tx.date, month) && benefitAccountIds.has(tx.accountId))
    .reduce((sum, tx) => sum + tx.amountCents, 0);
}
