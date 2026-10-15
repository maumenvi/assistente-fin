import { type LimitUsageRow } from './limit.usage.row.ts';

/** O que o widget de limites mostra (spec 023, data-model "LimitsWidgetData"). */
export interface LimitsWidgetData {
  readonly month: { readonly year: number; readonly month: number };
  /** Limites de gasto do mes, sem os escondidos, do mais para o menos usado. */
  readonly spendingLimits: readonly LimitUsageRow[];
  /** So os cartoes escolhidos (ativos, com limite), na ordem das contas. */
  readonly cards: readonly LimitUsageRow[];
}
