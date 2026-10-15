/**
 * Colunas pelas quais os Gastos Fixos podem ser ordenados (spec 006, RF-9).
 *
 * `dueDate` cobre a coluna de vencimento (dia + mes, RF-12); `category`/`account` ordenam
 * por id (o dominio nao conhece nomes denormalizados - isso e responsabilidade da borda que
 * exibe).
 */
export const FIXED_EXPENSE_SORT_FIELDS = [
  'dueDate',
  'description',
  'category',
  'account',
  'amount',
  'paid',
] as const;

/** Um dos valores de `FIXED_EXPENSE_SORT_FIELDS`. */
export type FixedExpenseSortField = (typeof FIXED_EXPENSE_SORT_FIELDS)[number];
