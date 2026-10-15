/** Forma minima de um gasto fixo para os totais do Dashboard (ver `DashboardTransaction`). */
export interface DashboardFixedExpense {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly expectedAmountCents: number;
}
