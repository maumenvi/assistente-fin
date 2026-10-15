import { type Transaction } from '../transaction/transaction.entity.ts';

/**
 * Saldo de uma conta ate `asOf`: soma de `transactions` daquela conta com data em ou antes
 * de `asOf` (ganho soma, gasto subtrai). Funcao pura, sem I/O - mesma formula usada no
 * Dashboard (`computeAccountBalance` do renderer), reimplementada aqui para uso no backend
 * (`ReconcileAccountBalanceUseCase`), sem duplicar logica de negocio entre as duas camadas
 * de forma divergente (mesma regra de piso de `openingBalanceDate`).
 *
 * `openingBalanceDate`, quando informada, atua como piso: transacoes ANTERIORES a ela sao
 * ignoradas (ja estao embutidas no saldo observado naquela data) - evita contar o mesmo
 * periodo duas vezes ao reconciliar depois de importar historico. Inclusiva nos dois
 * extremos (a propria "SALDO INICIAL", datada dela, e transacoes no mesmo dia entram).
 */
export function computeAccountBalance(
  transactions: readonly Transaction[],
  accountId: string,
  asOf: Date,
  openingBalanceDate: Date | null,
): number {
  return transactions
    .filter(
      (transaction) =>
        transaction.accountId === accountId &&
        transaction.date.getTime() <= asOf.getTime() &&
        (openingBalanceDate === null || transaction.date.getTime() >= openingBalanceDate.getTime()),
    )
    .reduce(
      (balance, transaction) =>
        balance + (transaction.type === 'income' ? transaction.amount.cents : -transaction.amount.cents),
      0,
    );
}
