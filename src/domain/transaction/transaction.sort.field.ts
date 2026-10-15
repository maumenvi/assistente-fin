/**
 * Colunas pelas quais o Extrato pode ser ordenado (spec 005, RF-4).
 *
 * Mapeiam direto para campos de `Transaction`: `category`/`account` ordenam por id (o
 * dominio nao conhece nomes denormalizados - isso e responsabilidade da borda que exibe).
 */
export const TRANSACTION_SORT_FIELDS = [
  'date',
  'type',
  'category',
  'account',
  'recurrence',
  'amount',
] as const;

/** Um dos valores de `TRANSACTION_SORT_FIELDS`. */
export type TransactionSortField = (typeof TRANSACTION_SORT_FIELDS)[number];
