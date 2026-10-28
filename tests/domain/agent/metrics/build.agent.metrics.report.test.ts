import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AgentMetricRecord } from '../../../../src/domain/agent/metrics/agent.metric.record.ts';
import { buildAgentMetricsReport } from '../../../../src/domain/agent/metrics/build.agent.metrics.report.ts';
import { buildConversationUsage } from '../../../../src/domain/agent/metrics/build.conversation.usage.ts';

function sampleRecord(overrides: Partial<AgentMetricRecord> = {}): AgentMetricRecord {
  return {
    id: 'm1',
    userId: 'u1',
    runId: 'r1',
    conversationId: 'c1',
    strategy: 'hybrid_3_tiers',
    tier: 'basic',
    role: 'fallback',
    model: 'google/gemini-2.0-flash',
    origin: 'openrouter',
    node: 'route',
    inputTokens: 1_000,
    outputTokens: 500,
    cachedTokens: 0,
    costMicroUsd: 300,
    baselineHighCostMicroUsd: 10_500,
    durationMs: 400,
    status: 'ok',
    createdAt: '2026-10-26T10:00:00.000Z',
    ...overrides,
  };
}

describe('buildAgentMetricsReport & buildConversationUsage (spec 038)', () => {
  it('agrega totais, barras por LLM (ordenadas por tier) e comparativo por estrategia', () => {
    const records: AgentMetricRecord[] = [
      sampleRecord({
        id: 'm1',
        runId: 'r1',
        tier: 'basic',
        role: 'fallback',
        model: 'google/gemini-2.0-flash',
        inputTokens: 1_000,
        outputTokens: 500,
        costMicroUsd: 300,
        baselineHighCostMicroUsd: 10_500,
      }),
      sampleRecord({
        id: 'm2',
        runId: 'r1',
        tier: 'medium',
        role: 'fast',
        model: 'openai/gpt-4o-mini',
        inputTokens: 2_000,
        outputTokens: 1_000,
        costMicroUsd: 900,
        baselineHighCostMicroUsd: 21_000,
      }),
      sampleRecord({
        id: 'm3',
        runId: 'r2',
        strategy: 'single_high',
        tier: 'high',
        role: 'main',
        model: 'anthropic/claude-3.5-sonnet',
        inputTokens: 2_000,
        outputTokens: 1_000,
        costMicroUsd: 21_000,
        baselineHighCostMicroUsd: 21_000,
      }),
    ];

    const report = buildAgentMetricsReport(records);

    assert.equal(report.totals.totalTokens, 7_500);
    assert.equal(report.totals.totalCostMicroUsd, 22_200);
    assert.equal(report.totals.baselineHighCostMicroUsd, 52_500);
    assert.equal(report.totals.savedCostMicroUsd, 30_300);
    assert.equal(report.totals.runCount, 2);
    assert.equal(report.totals.callCount, 3);
    assert.equal(report.totals.successRatePercent, 100);

    // Ordenado por tier: high -> medium -> basic
    assert.deepEqual(
      report.byLlm.map((r) => r.tier),
      ['high', 'medium', 'basic'],
    );
    assert.equal(report.byLlm[0]?.totalTokens, 3_000);
    assert.equal(report.byLlm[1]?.totalTokens, 3_000);
    assert.equal(report.byLlm[2]?.totalTokens, 1_500);

    // Estrategias: hybrid_3_tiers economiza 30_300 sobre 31_500 (~96.2%)
    const hybrid = report.byStrategy.find((s) => s.strategy === 'hybrid_3_tiers');
    assert.ok(hybrid);
    assert.equal(hybrid.savedCostMicroUsd, 30_300);
    assert.equal(hybrid.savedPercentVsHigh, 96.2);
  });

  it('soma tokens e custo da conversa em buildConversationUsage', () => {
    const summary = buildConversationUsage([
      { consumed: { steps: 2, ms: 500, inputTokens: 1200, outputTokens: 300, cachedTokens: 0, costMicroUsd: 450 } },
      { consumed: { steps: 1, ms: 300, inputTokens: 800, outputTokens: 200, cachedTokens: 100, costMicroUsd: 350 } },
    ]);
    assert.equal(summary.totalTokens, 2500);
    assert.equal(summary.costMicroUsd, 800);
    assert.equal(summary.runCount, 2);
  });
});
