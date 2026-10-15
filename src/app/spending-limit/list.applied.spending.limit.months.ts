import { type SpendingLimit } from '../../domain/spending-limit/spending.limit.entity.ts';

/**
 * Meses ja aplicados para um `SpendingLimitPlan` (spec 016).
 *
 * Funcao pura (sem I/O, rule 8): extrai o conjunto de meses (`"YYYY-MM"`) a partir de todo
 * `SpendingLimit` cujo `definitionId` aponta para o plano pedido. Usada tanto por
 * `ApplySpendingLimitMonthUseCase` (idempotencia) quanto pela listagem da tela "Limites de
 * gasto" - o chamador busca os `spendingLimits` (ex.: `database.spendingLimits.listByUser`) e
 * passa aqui, sem esta funcao saber de banco. Equivalente a `listLaunchedIncomeMonths`.
 */
export function listAppliedSpendingLimitMonths(
  spendingLimits: readonly SpendingLimit[],
  planId: string,
): ReadonlySet<string> {
  return new Set(
    spendingLimits
      .filter((limit) => limit.definitionId === planId)
      .map((limit) => limit.period.toString()),
  );
}
