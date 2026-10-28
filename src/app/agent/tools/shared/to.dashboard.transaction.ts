import { type Transaction } from '../../../../domain/transaction/transaction.entity.ts';
import { type WithCategory } from '../../../category/with.category.ts';
import { type DashboardTransaction } from '../../../dashboard/dashboard.transaction.ts';

/** Lancamento do caso de uso na forma que os calculos do Dashboard leem (mesma regra do app). */
export function toDashboardTransaction(row: WithCategory<Transaction>): DashboardTransaction {
  const tx = row.item;
  return {
    date: tx.date.toISOString(),
    type: tx.type,
    amountCents: tx.amount.cents,
    accountId: tx.accountId,
    categoryId: tx.categoryId,
    categoryName: row.categoryName,
    isSystemCategory: row.isSystemCategory,
    isSystemTransfer: row.isSystemTransfer,
    isSystemCardPayment: row.isSystemCardPayment,
    transferGroupId: tx.transferGroupId,
    cardPaymentGroupId: tx.cardPaymentGroupId,
    fixedExpenseId: tx.fixedExpenseId,
  };
}
