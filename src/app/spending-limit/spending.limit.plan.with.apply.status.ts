import { type SpendingLimitPlan } from '../../domain/spending-limit/spending.limit.plan.entity.ts';
import { type WithCategory } from '../category/with.category.ts';

/**
 * Um `SpendingLimitPlan` acompanhado dos dados da categoria (`WithCategory`) e dos meses ja
 * aplicados (spec 016) - usado pela tela "Limites de gasto" para decidir, por linha e por mes
 * selecionado, se mostra o botao "Aplicar" ou o estado "Aplicado". Equivalente a
 * `IncomeWithLaunchStatus`.
 */
export interface SpendingLimitPlanWithApplyStatus extends WithCategory<SpendingLimitPlan> {
  /** Meses (`"YYYY-MM"`) que ja tem um `SpendingLimit` vinculado a este plano. */
  readonly appliedMonths: readonly string[];
}
