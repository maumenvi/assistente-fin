import { Month } from '../../domain/shared/month.value.object.ts';
import {
  summarizeTransactionsByAccountBenefit,
  type TransactionBenefitSummary,
} from '../../domain/transaction/summarize.transactions.by.account.benefit.ts';
import { type TransactionRepository } from '../transaction/transaction.repository.port.ts';
import { type AccountRepository } from '../account/account.repository.port.ts';

/**
 * Busca as transacoes e contas de `userId` no `month` informado e delega a
 * `summarizeTransactionsByAccountBenefit` (spec 011, decisao "risco 5" do plano) - funcao
 * central de agregacao consumida por Ganhos, Limites e Dashboard, em vez de cada tela somar
 * totais inline por conta propria.
 */
export async function resolveBenefitTotalsForMonth(
  userId: string,
  month: Month,
  transactions: TransactionRepository,
  accounts: AccountRepository,
): Promise<TransactionBenefitSummary> {
  const [allTransactions, allAccounts] = await Promise.all([
    transactions.listByUser(userId),
    accounts.listByUser(userId),
  ]);

  const monthTransactions = allTransactions.filter((transaction) =>
    Month.fromDate(transaction.date).equals(month),
  );

  return summarizeTransactionsByAccountBenefit(monthTransactions, allAccounts);
}
