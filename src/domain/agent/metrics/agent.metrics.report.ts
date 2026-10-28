import { type LlmTier } from '../routing/llm.tier.ts';
import { type RoutingStrategy } from '../routing/routing.strategy.ts';

/** Linha do grafico de barras por LLM / tier (spec 038, FR-003). */
export interface LlmBarMetricRow {
  readonly tier: LlmTier;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly costMicroUsd: number;
  readonly callCount: number;
  readonly tokenSharePercent: number;
  readonly costSharePercent: number;
}

/** Linha da tabela comparativa de estrategias de roteamento (spec 038, FR-018, FR-020). */
export interface StrategyMetricRow {
  readonly strategy: RoutingStrategy;
  readonly runCount: number;
  readonly callCount: number;
  readonly totalTokens: number;
  readonly avgTokensPerRun: number;
  readonly totalCostMicroUsd: number;
  readonly avgCostMicroUsd: number;
  readonly baselineHighCostMicroUsd: number;
  readonly savedCostMicroUsd: number;
  readonly savedPercentVsHigh: number;
  readonly successRatePercent: number;
  readonly avgDurationMs: number;
}

/** Relatorio consolidado de metricas e eficacia das LLMs (spec 038, data-model.md 1.6). */
export interface AgentMetricsReport {
  readonly totals: {
    readonly totalTokens: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalCostMicroUsd: number;
    readonly baselineHighCostMicroUsd: number;
    readonly savedCostMicroUsd: number;
    readonly savedCostPercent: number;
    readonly runCount: number;
    readonly callCount: number;
    readonly successRatePercent: number;
  };
  readonly byLlm: readonly LlmBarMetricRow[];
  readonly byStrategy: readonly StrategyMetricRow[];
}

