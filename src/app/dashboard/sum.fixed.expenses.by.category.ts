import { type DashboardFixedExpense } from './dashboard.fixed.expense.ts';
import { type CategoryTotal } from './category.total.ts';

/**
 * Soma os gastos fixos do usuario por categoria, pelo `expectedAmountCents` (spec 021, RF-57).
 *
 * **Independe de `paid`** (RF-58): o gasto fixo e uma despesa que o usuario vai ter de
 * qualquer forma - e o motivo de ele te-lo cadastrado como fixo. Marcar como pago e so um
 * registro de controle e nao muda nada aqui.
 *
 * **Vale para todo mes exibido**: `FixedExpense` nao tem data-ancora no modelo (so `dueDay` e
 * um `referenceMonth` opcional), entao nao ha informacao para dizer "este gasto fixo comecou
 * em marco". E o mesmo comportamento que a previsao ja tem (`projectedFixedExpenses`).
 *
 * Cai na MESMA linha de uma categoria que tambem tem lancamentos comuns: o usuario ve
 * "MERCADO R$ 850,00" sem precisar saber que parte veio de gasto fixo (spec 021, data-model 4).
 */
export function sumFixedExpensesByCategory(
  fixedExpenses: readonly DashboardFixedExpense[],
  base: readonly CategoryTotal[],
): readonly CategoryTotal[] {
  const totals = new Map(base.map((row) => [row.categoryId, row]));

  for (const expense of fixedExpenses) {
    const existing = totals.get(expense.categoryId);
    totals.set(expense.categoryId, {
      categoryId: expense.categoryId,
      categoryName: existing?.categoryName ?? expense.categoryName,
      totalCents: (existing?.totalCents ?? 0) + expense.expectedAmountCents,
    });
  }

  return [...totals.values()].sort((a, b) => b.totalCents - a.totalCents);
}
