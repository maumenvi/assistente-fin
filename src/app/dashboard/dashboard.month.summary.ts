import { type CategoryTotal } from './category.total.ts';

/** Numeros do mes que o Dashboard mostra (desktop e celular). */
export interface DashboardMonthSummary {
  readonly incomeByCategory: readonly CategoryTotal[];
  readonly totalIncomeCents: number;
  readonly benefitIncomeCents: number;
  readonly expenseByCategory: readonly CategoryTotal[];
  readonly totalExpenseCents: number;
  /** Resultado do mes (fluxo): ganhos - gastos (spec 016, RF-11). */
  readonly balanceCents: number;
  /** Saldo patrimonial de hoje nas contas que nao sao cartao (spec 016, RF-12). */
  readonly totalAvailableBalanceCents: number;
}
