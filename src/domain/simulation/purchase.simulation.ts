import { Money } from '../shared/money.value.object.ts';
import { Month } from '../shared/month.value.object.ts';
import { recurrenceAppliesToMonth } from '../shared/recurrence.applies.to.month.ts';
import { type PurchaseSimulation } from './simulation.entity.ts';
import { buildInstallmentPlan } from '../money/split.evenly.ts';

/** Horizonte padrao de previa pra compra recorrente (spec 001, CA-10; sem fim, ver plan.md decisao 13). */
const DEFAULT_HORIZON_MONTHS = 12;

/** Quanto uma simulacao impacta um mes especifico (spec 001, RF-10). */
export interface MonthlyImpact {
  readonly month: Month;
  readonly amount: Money;
}

/** Opcoes de `calculatePurchaseImpact`. */
export interface CalculatePurchaseImpactOptions {
  /** So usado no modo recorrente (CA-10) - quantos meses pra frente mostrar. Default 12. */
  readonly horizonMonths?: number | undefined;
}

/**
 * Calcula em quais meses uma simulacao de compra pesa, e quanto (spec 001, RF-9, RF-10) -
 * funcao pura, sem I/O. Os tres modos de `CreateSimulationProps` sao mutuamente exclusivos
 * (reforcado na entidade):
 *
 * - **A vista** (CA-8, `installments === 1` e `recurrence.kind === 'none'`): so o mes da
 *   compra, valor cheio.
 * - **Parcelada** (CA-9, `installments > 1`): `buildInstallmentPlan` distribui o valor a
 *   partir do mes da compra, uma parcela por mes.
 * - **Recorrente** (CA-10, `recurrence.repeats()`): repete o valor cheio em todo mes em que
 *   a recorrencia estiver ativa, dentro de `horizonMonths` a partir da compra e ate a data
 *   final da recorrencia (spec 003, RF-16).
 */
export function calculatePurchaseImpact(
  simulation: PurchaseSimulation,
  options: CalculatePurchaseImpactOptions = {},
): MonthlyImpact[] {
  const purchaseMonth = Month.fromDate(simulation.date);

  if (simulation.isInstallment()) {
    const plan = buildInstallmentPlan(simulation.amount.cents, simulation.installments);
    let month = purchaseMonth;
    return plan.map((cents) => {
      const impact = { month, amount: Money.fromCents(cents, simulation.amount.currency) };
      month = month.next();
      return impact;
    });
  }

  if (simulation.isRecurring()) {
    const horizonMonths = options.horizonMonths ?? DEFAULT_HORIZON_MONTHS;
    const impacts: MonthlyImpact[] = [];
    let month = purchaseMonth;
    for (let i = 0; i < horizonMonths; i += 1) {
      if (recurrenceAppliesToMonth(simulation.recurrence, purchaseMonth, month)) {
        impacts.push({ month, amount: simulation.amount });
      }
      month = month.next();
    }
    return impacts;
  }

  return [{ month: purchaseMonth, amount: simulation.amount }];
}
