import { type DashboardTransaction } from './dashboard.transaction.ts';

function isOnOrBefore(isoDate: string, asOf: Date): boolean {
  const date = new Date(isoDate);
  return date.getTime() <= asOf.getTime();
}

/** `true` se a data ISO cai em ou depois de `floor` (comparado por dia calendario UTC). */
function isOnOrAfter(isoDate: string, floor: Date): boolean {
  const date = new Date(isoDate);
  return date.getTime() >= floor.getTime();
}

/**
 * Saldo atual de uma conta: soma de todas as `transactions` daquela conta com data em ou antes
 * de `asOf` (ganho soma, gasto subtrai) - sempre o saldo "de hoje", independente do mes que o
 * Dashboard esta filtrando no resto da tela (decisao do usuario: "Saldo em cada conta" nao
 * acompanha o seletor de mes).
 *
 * Nao soma `Account.openingBalanceCents` separadamente (spec 015): o saldo/gasto inicial
 * configurado ja vira uma `Transaction` real ("SALDO INICIAL", gerada por
 * `CreateAccountUseCase`) na hora da criacao da conta, entao somar o campo cru de novo aqui
 * contaria o valor duas vezes.
 *
 * `openingBalanceDate` (revisao do bug de saldo inicial vs. saldo atual): quando informada,
 * atua como piso - transacoes ANTERIORES a ela sao ignoradas (ja estao embutidas no valor do
 * saldo observado naquela data), evitando contar o mesmo periodo duas vezes ao importar
 * historico. Inclusiva: a propria "SALDO INICIAL" (datada dela) e transacoes no mesmo dia
 * entram normalmente. `null`/`undefined` (contas legadas) preserva o comportamento antigo -
 * sem piso, soma tudo ate `asOf`.
 */
export function computeAccountBalance(
  transactions: readonly DashboardTransaction[],
  accountId: string,
  asOf: Date,
  openingBalanceDate?: Date | null,
): number {
  return transactions
    .filter(
      (tx) =>
        tx.accountId === accountId &&
        isOnOrBefore(tx.date, asOf) &&
        (openingBalanceDate == null || isOnOrAfter(tx.date, openingBalanceDate)),
    )
    .reduce((balance, tx) => balance + (tx.type === 'income' ? tx.amountCents : -tx.amountCents), 0);
}
