import { type Month } from '../shared/month.value.object.ts';
import {
  calculateMonthlyForecast,
  type ForecastInputs,
} from '../forecast/monthly.forecast.ts';
import {
  type ScenarioAdjustment,
  type ScenarioAdjustmentTarget,
} from './scenario.adjustment.ts';

/** Tudo que a projecao precisa ja carregado, menos o mes (ela varre `months`). */
export interface ScenarioProjectionInputs {
  /** Mesmos dados de `calculateMonthlyForecast`, sem o `month` (a projecao itera). */
  readonly baseInputs: Omit<ForecastInputs, 'month'>;
  readonly adjustments: readonly ScenarioAdjustment[];
  /** Meses a projetar, em ordem (o caso de uso monta a partir do mes atual + horizonte). */
  readonly months: readonly Month[];
}

/** Projecao de um mes: saldo previsto com e sem o cenario, e o delta que o cenario aplicou. */
export interface ScenarioProjectionMonth {
  readonly month: Month;
  readonly baselineBalanceCents: number;
  readonly scenarioBalanceCents: number;
  readonly incomeDeltaCents: number;
  readonly expenseDeltaCents: number;
}

/** Resultado de `projectScenario`. */
export interface ScenarioProjection {
  readonly months: readonly ScenarioProjectionMonth[];
}

/**
 * Projeta o saldo mes a mes com e sem um cenario (spec 002, RF-33) - funcao pura, sem I/O.
 *
 * Para cada mes: roda a previsao adaptativa da 001 (`calculateMonthlyForecast`) como
 * baseline, deriva o ganho/gasto mensal ajustado pelos `adjustments` que incidem naquele mes
 * e soma o delta ao saldo previsto. Composicao dos ajustes de mesmo alvo no mesmo mes:
 * primeiro os `replace` (o ultimo da lista vence), depois os `add` (somados); o valor final
 * nunca fica negativo (`max(0, ...)`). Nada e persistido nem materializado aqui.
 */
export function projectScenario(inputs: ScenarioProjectionInputs): ScenarioProjection {
  const months = inputs.months.map((month): ScenarioProjectionMonth => {
    const baseline = calculateMonthlyForecast({ ...inputs.baseInputs, month });

    const baselineIncomeCents = baseline.projectedIncome.cents;
    const baselineExpenseCents =
      baseline.projectedFixedExpenses.cents + baseline.estimatedNonFixedExpenses.cents;

    const incomeDeltaCents =
      adjustedValue('income', baselineIncomeCents, inputs.adjustments, month) - baselineIncomeCents;
    const expenseDeltaCents =
      adjustedValue('expense', baselineExpenseCents, inputs.adjustments, month) - baselineExpenseCents;

    return {
      month,
      baselineBalanceCents: baseline.projectedBalance.cents,
      scenarioBalanceCents: baseline.projectedBalance.cents + incomeDeltaCents - expenseDeltaCents,
      incomeDeltaCents,
      expenseDeltaCents,
    };
  });

  return { months };
}

/** Valor mensal do alvo (ganho ou gasto) depois dos ajustes que incidem em `month`. */
function adjustedValue(
  target: ScenarioAdjustmentTarget,
  baselineCents: number,
  adjustments: readonly ScenarioAdjustment[],
  month: Month,
): number {
  const applicable = adjustments.filter(
    (adjustment) => adjustment.target === target && adjustment.appliesTo(month),
  );

  let value = baselineCents;
  for (const adjustment of applicable) {
    if (adjustment.mode === 'replace') value = adjustment.amountCents;
  }
  for (const adjustment of applicable) {
    if (adjustment.mode === 'add') value += adjustment.amountCents;
  }
  return Math.max(0, value);
}
