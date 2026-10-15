import { type Transaction } from '../../domain/transaction/transaction.entity.ts';
import { Month } from '../../domain/shared/month.value.object.ts';

/**
 * Meses ja lancados no Extrato para um `Income` (spec 012, Q4).
 *
 * Funcao pura (sem I/O, rule 8): extrai o conjunto de meses (`"YYYY-MM"`) a partir de toda
 * `Transaction` cujo `incomeId` aponta para o `income` pedido. Usada tanto por
 * `LaunchIncomeMonthUseCase` (idempotencia, RF-7) quanto pela listagem da tela "Ganhos"
 * (RF-3/RF-6/RF-10) - o chamador busca as `transactions` (ex.: `database.transactions.listByUser`)
 * e passa aqui, sem esta funcao saber de banco.
 */
export function listLaunchedIncomeMonths(
  transactions: readonly Transaction[],
  incomeId: string,
): ReadonlySet<string> {
  return new Set(
    transactions
      .filter((transaction) => transaction.incomeId === incomeId)
      .map((transaction) => Month.fromDate(transaction.date).toString()),
  );
}
