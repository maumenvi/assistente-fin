import { type DashboardTransaction } from './dashboard.transaction.ts';
import { type DashboardAccount } from './dashboard.account.ts';
import { computeAccountBalance } from './compute.view.account.balance.ts';

/**
 * Saldo disponível total (spec 016, RF-12): soma o saldo atual (`computeAccountBalance`) de
 * todas as contas de saldo do usuário - qualquer `kind` diferente de `credit-card`, incluindo
 * contas-benefício (RF-12 explicita "incluindo contas-benefício"). Cartão de crédito nunca
 * entra aqui: é dívida/compromisso, não saldo disponível (decisão de modelo da spec 016).
 *
 * Não acompanha o mês selecionado no Dashboard - mesma decisão de "Saldo em cada conta"
 * (sempre o saldo "de hoje", `asOf = new Date()`).
 */
export function computeTotalAvailableBalance(
  transactions: readonly DashboardTransaction[],
  accounts: readonly DashboardAccount[],
): number {
  const asOf = new Date();
  return accounts
    .filter((account) => account.kind !== 'credit-card')
    .reduce(
      (sum, account) =>
        sum +
        computeAccountBalance(
          transactions,
          account.id,
          asOf,
          account.openingBalanceDate ? new Date(account.openingBalanceDate) : null,
        ),
      0,
    );
}
