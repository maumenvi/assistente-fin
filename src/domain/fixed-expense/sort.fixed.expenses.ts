import { type FixedExpense } from './fixed.expense.entity.ts';
import { type FixedExpenseSortField } from './fixed.expense.sort.field.ts';

/** Direcao de ordenacao. */
export type SortDirection = 'asc' | 'desc';

/**
 * Chave numerica composta para a coluna de vencimento (RF-12): mes tem precedencia sobre
 * dia. `referenceMonth` ausente e tratado como "menor que qualquer mes" (decisao confirmada
 * do plano 006, 4.2) - vira `0`, abaixo de 1-12. Multiplicar o mes por 32 (> 31 dias
 * possiveis) garante que a comparacao de mes sempre prevalece sobre a de dia.
 */
function dueDateKey(expense: FixedExpense): number {
  const month = expense.referenceMonth ?? 0;
  return month * 32 + expense.dueDay;
}

/** Extrai a chave comparavel de `sortBy` para um gasto fixo. */
function sortKey(expense: FixedExpense, sortBy: FixedExpenseSortField): number | string {
  switch (sortBy) {
    case 'dueDate':
      return dueDateKey(expense);
    case 'description':
      return expense.description ?? '';
    case 'category':
      return expense.categoryId;
    case 'account':
      return expense.accountId;
    case 'amount':
      return expense.expectedAmount.cents;
    case 'paid':
      return expense.paid ? 1 : 0;
  }
}

/**
 * Ordena `rows` por `sortBy`/`direction` (spec 006, RF-9..RF-12).
 *
 * Funcao pura: nao muta `rows`, devolve um array novo. Vive em `src/domain` (nao no
 * renderer) porque e reaproveitada pela tool MCP `fixedExpense.query` (spec 010) - mesma
 * ordenacao usada na tela de Gastos Fixos e na borda MCP, sem duplicar a logica (mesmo
 * padrao de `sortTransactions`, spec 005).
 */
export function sortFixedExpenses(
  rows: readonly FixedExpense[],
  sortBy: FixedExpenseSortField,
  direction: SortDirection,
): FixedExpense[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const keyA = sortKey(a, sortBy);
    const keyB = sortKey(b, sortBy);
    if (keyA < keyB) return -1 * factor;
    if (keyA > keyB) return 1 * factor;
    return 0;
  });
}
