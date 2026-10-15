import { type Transaction } from './transaction.entity.ts';
import { type TransactionSortField } from './transaction.sort.field.ts';

/** Direcao de ordenacao. */
export type SortDirection = 'asc' | 'desc';

/** Extrai a chave comparavel de `sortBy` para uma transacao. */
function sortKey(transaction: Transaction, sortBy: TransactionSortField): number | string {
  switch (sortBy) {
    case 'date':
      return transaction.date.getTime();
    case 'type':
      return transaction.type;
    case 'category':
      return transaction.categoryId;
    case 'account':
      return transaction.accountId;
    case 'recurrence':
      return transaction.recurrence.frequency;
    case 'amount':
      return transaction.amount.cents;
  }
}

/**
 * Ordena `rows` por `sortBy`/`direction` (spec 005, RF-4/RF-5/RF-6; CA-4/CA-5/CA-6).
 *
 * Funcao pura: nao muta `rows`, devolve um array novo. Vive em `src/domain` (nao no
 * renderer) porque e reaproveitada pela tool MCP `statement.query` (spec 010) - mesma
 * ordenacao usada na tela do Extrato e na borda MCP, sem duplicar a logica.
 */
export function sortTransactions(
  rows: readonly Transaction[],
  sortBy: TransactionSortField,
  direction: SortDirection,
): Transaction[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const keyA = sortKey(a, sortBy);
    const keyB = sortKey(b, sortBy);
    if (keyA < keyB) return -1 * factor;
    if (keyA > keyB) return 1 * factor;
    return 0;
  });
}
