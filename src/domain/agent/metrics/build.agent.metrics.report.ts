import { LLM_TIERS, type LlmTier } from '../routing/llm.tier.ts';
import { ROUTING_STRATEGIES, type RoutingStrategy } from '../routing/routing.strategy.ts';
import { type AgentMetricRecord } from './agent.metric.record.ts';
import { type AgentMetricsReport, type LlmBarMetricRow, type StrategyMetricRow } from './agent.metrics.report.ts';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Consolida registros permanentes de telemetria em um relatorio completo com
 * totais, grafico de barras por LLM e comparativo de estrategias (spec 038, FR-003, FR-018, FR-020).
 */
export function buildAgentMetricsReport(records: readonly AgentMetricRecord[]): AgentMetricsReport {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalCostMicroUsd = 0;
  let baselineHighCostMicroUsd = 0;
  const runStatus = new Map<string, boolean>();

  const llmMap = new Map<
    string,
    {
      tier: LlmTier;
      model: string;
      inputTokens: number;
      outputTokens: number;
      costMicroUsd: number;
      callCount: number;
    }
  >();

  const strategyMap = new Map<
    RoutingStrategy,
    {
      runs: Map<string, boolean>;
      callCount: number;
      totalTokens: number;
      totalCostMicroUsd: number;
      baselineHighCostMicroUsd: number;
      totalDurationMs: number;
    }
  >();

  for (const r of records) {
    inputTokens += r.inputTokens;
    outputTokens += r.outputTokens;
    totalCostMicroUsd += r.costMicroUsd;
    baselineHighCostMicroUsd += r.baselineHighCostMicroUsd;

    const prevRunOk = runStatus.get(r.runId) ?? true;
    runStatus.set(r.runId, prevRunOk && r.status !== 'error');

    const llmKey = `${r.tier}::${r.model}`;
    const existingLlm = llmMap.get(llmKey);
    if (existingLlm !== undefined) {
      existingLlm.inputTokens += r.inputTokens;
      existingLlm.outputTokens += r.outputTokens;
      existingLlm.costMicroUsd += r.costMicroUsd;
      existingLlm.callCount += 1;
    } else {
      llmMap.set(llmKey, {
        tier: r.tier,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costMicroUsd: r.costMicroUsd,
        callCount: 1,
      });
    }

    let strat = strategyMap.get(r.strategy);
    if (strat === undefined) {
      strat = {
        runs: new Map<string, boolean>(),
        callCount: 0,
        totalTokens: 0,
        totalCostMicroUsd: 0,
        baselineHighCostMicroUsd: 0,
        totalDurationMs: 0,
      };
      strategyMap.set(r.strategy, strat);
    }
    const prevStratRunOk = strat.runs.get(r.runId) ?? true;
    strat.runs.set(r.runId, prevStratRunOk && r.status !== 'error');
    strat.callCount += 1;
    strat.totalTokens += r.inputTokens + r.outputTokens;
    strat.totalCostMicroUsd += r.costMicroUsd;
    strat.baselineHighCostMicroUsd += r.baselineHighCostMicroUsd;
    strat.totalDurationMs += r.durationMs;
  }

  const totalTokens = inputTokens + outputTokens;
  const runCount = runStatus.size;
  const okRunCount = [...runStatus.values()].filter(Boolean).length;
  const successRatePercent = runCount > 0 ? round1((okRunCount / runCount) * 100) : 100;
  const savedCostMicroUsd = Math.max(0, baselineHighCostMicroUsd - totalCostMicroUsd);
  const savedCostPercent =
    baselineHighCostMicroUsd > 0 ? round1((savedCostMicroUsd / baselineHighCostMicroUsd) * 100) : 0;

  const tierRank = new Map<LlmTier, number>(LLM_TIERS.map((t, idx) => [t, idx]));
  const byLlm: LlmBarMetricRow[] = [...llmMap.values()]
    .map((item) => {
      const itemTotalTokens = item.inputTokens + item.outputTokens;
      return {
        tier: item.tier,
        model: item.model,
        inputTokens: item.inputTokens,
        outputTokens: item.outputTokens,
        totalTokens: itemTotalTokens,
        costMicroUsd: item.costMicroUsd,
        callCount: item.callCount,
        tokenSharePercent: totalTokens > 0 ? round1((itemTotalTokens / totalTokens) * 100) : 0,
        costSharePercent: totalCostMicroUsd > 0 ? round1((item.costMicroUsd / totalCostMicroUsd) * 100) : 0,
      };
    })
    .sort((a, b) => {
      const rankDiff = (tierRank.get(a.tier) ?? 99) - (tierRank.get(b.tier) ?? 99);
      if (rankDiff !== 0) return rankDiff;
      return b.totalTokens - a.totalTokens;
    });

  const strategyRank = new Map<RoutingStrategy, number>(ROUTING_STRATEGIES.map((s, idx) => [s, idx]));
  const byStrategy: StrategyMetricRow[] = [...strategyMap.entries()]
    .map(([strategy, data]) => {
      const sRunCount = data.runs.size;
      const sOkRuns = [...data.runs.values()].filter(Boolean).length;
      const sSavedCost = Math.max(0, data.baselineHighCostMicroUsd - data.totalCostMicroUsd);
      return {
        strategy,
        runCount: sRunCount,
        callCount: data.callCount,
        totalTokens: data.totalTokens,
        avgTokensPerRun: sRunCount > 0 ? Math.round(data.totalTokens / sRunCount) : 0,
        totalCostMicroUsd: data.totalCostMicroUsd,
        avgCostMicroUsd: sRunCount > 0 ? Math.round(data.totalCostMicroUsd / sRunCount) : 0,
        baselineHighCostMicroUsd: data.baselineHighCostMicroUsd,
        savedCostMicroUsd: sSavedCost,
        savedPercentVsHigh:
          data.baselineHighCostMicroUsd > 0 ? round1((sSavedCost / data.baselineHighCostMicroUsd) * 100) : 0,
        successRatePercent: sRunCount > 0 ? round1((sOkRuns / sRunCount) * 100) : 100,
        avgDurationMs: data.callCount > 0 ? Math.round(data.totalDurationMs / data.callCount) : 0,
      };
    })
    .sort((a, b) => (strategyRank.get(a.strategy) ?? 99) - (strategyRank.get(b.strategy) ?? 99));

  return {
    totals: {
      totalTokens,
      inputTokens,
      outputTokens,
      totalCostMicroUsd,
      baselineHighCostMicroUsd,
      savedCostMicroUsd,
      savedCostPercent,
      runCount,
      callCount: records.length,
      successRatePercent,
    },
    byLlm,
    byStrategy,
  };
}

