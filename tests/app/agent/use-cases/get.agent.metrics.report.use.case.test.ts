import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GetAgentMetricsReportUseCase } from '../../../../src/app/agent/use-cases/get.agent.metrics.report.use.case.ts';
import { FakeAgentStore } from '../../../../src/database/fake/agent.store.fake.ts';

describe('GetAgentMetricsReportUseCase (spec 038)', () => {
  it('filtra por usuario, estrategia e conversa e devolve relatorio consolidado', async () => {
    const store = new FakeAgentStore();
    await store.metrics.append({
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
      inputTokens: 500,
      outputTokens: 200,
      cachedTokens: 0,
      costMicroUsd: 130,
      baselineHighCostMicroUsd: 4500,
      durationMs: 250,
      status: 'ok',
      createdAt: '2026-10-26T10:00:00.000Z',
    });
    await store.metrics.append({
      id: 'm2',
      userId: 'u1',
      runId: 'r2',
      conversationId: 'c2',
      strategy: 'single_high',
      tier: 'high',
      role: 'main',
      model: 'anthropic/claude-3.5-sonnet',
      origin: 'openrouter',
      node: 'react:0',
      inputTokens: 1000,
      outputTokens: 400,
      cachedTokens: 0,
      costMicroUsd: 9000,
      baselineHighCostMicroUsd: 9000,
      durationMs: 900,
      status: 'ok',
      createdAt: '2026-10-26T11:00:00.000Z',
    });

    const useCase = new GetAgentMetricsReportUseCase({ store });
    const full = await useCase.execute({ userId: 'u1' });
    assert.equal(full.totals.totalTokens, 2100);
    assert.equal(full.byLlm.length, 2);

    const onlyConv1 = await useCase.execute({ userId: 'u1', conversationId: 'c1' });
    assert.equal(onlyConv1.totals.totalTokens, 700);
    assert.equal(onlyConv1.totals.totalCostMicroUsd, 130);
  });
});

