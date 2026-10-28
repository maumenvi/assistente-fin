import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type LlmTier } from '../../../../src/domain/agent/routing/llm.tier.ts';
import { selectTierForStep } from '../../../../src/domain/agent/routing/select.tier.for.step.ts';

const ALL_TIERS = new Set<LlmTier>(['high', 'medium', 'basic']);

describe('selectTierForStep (spec 038, US4)', () => {
  it('hybrid_3_tiers roteia classificacao para basic, consulta padrao para medium e escrita/complexa para high', () => {
    const routeDecision = selectTierForStep({
      strategy: 'hybrid_3_tiers',
      node: 'route',
      intent: null,
      stepIndex: 0,
      toolCallCount: 0,
      hasFailures: false,
      availableTiers: ALL_TIERS,
    });
    assert.equal(routeDecision.tier, 'basic');
    assert.equal(routeDecision.role, 'fallback');

    const queryDecision = selectTierForStep({
      strategy: 'hybrid_3_tiers',
      node: 'react',
      intent: 'query',
      stepIndex: 0,
      toolCallCount: 1,
      hasFailures: false,
      availableTiers: ALL_TIERS,
    });
    assert.equal(queryDecision.tier, 'medium');
    assert.equal(queryDecision.role, 'fast');

    const writeDecision = selectTierForStep({
      strategy: 'hybrid_3_tiers',
      node: 'react',
      intent: 'write_request',
      stepIndex: 0,
      toolCallCount: 0,
      hasFailures: false,
      availableTiers: ALL_TIERS,
    });
    assert.equal(writeDecision.tier, 'high');
    assert.equal(writeDecision.role, 'main');
  });

  it('progressive_escalation sobe de basic -> medium -> high conforme os passos avancam', () => {
    const step0 = selectTierForStep({
      strategy: 'progressive_escalation',
      node: 'react',
      intent: 'query',
      stepIndex: 0,
      toolCallCount: 0,
      hasFailures: false,
      availableTiers: ALL_TIERS,
    });
    assert.equal(step0.tier, 'basic');

    const step1 = selectTierForStep({
      strategy: 'progressive_escalation',
      node: 'react',
      intent: 'query',
      stepIndex: 1,
      toolCallCount: 1,
      hasFailures: false,
      availableTiers: ALL_TIERS,
    });
    assert.equal(step1.tier, 'medium');

    const step2 = selectTierForStep({
      strategy: 'progressive_escalation',
      node: 'react',
      intent: 'query',
      stepIndex: 2,
      toolCallCount: 2,
      hasFailures: false,
      availableTiers: ALL_TIERS,
    });
    assert.equal(step2.tier, 'high');
  });

  it('tool_heuristic e single_high respeitam seus criterios e fazem fallback quando um nivel nao esta disponivel', () => {
    const heuristicHigh = selectTierForStep({
      strategy: 'tool_heuristic',
      node: 'react',
      intent: 'query',
      stepIndex: 1,
      toolCallCount: 2,
      hasFailures: false,
      availableTiers: ALL_TIERS,
    });
    assert.equal(heuristicHigh.tier, 'high');

    const singleHigh = selectTierForStep({
      strategy: 'single_high',
      node: 'route',
      intent: null,
      stepIndex: 0,
      toolCallCount: 0,
      hasFailures: false,
      availableTiers: ALL_TIERS,
    });
    assert.equal(singleHigh.tier, 'high');

    const onlyHighAvailable = selectTierForStep({
      strategy: 'hybrid_3_tiers',
      node: 'route',
      intent: null,
      stepIndex: 0,
      toolCallCount: 0,
      hasFailures: false,
      availableTiers: new Set<LlmTier>(['high']),
    });
    assert.equal(onlyHighAvailable.tier, 'high');
    assert.equal(onlyHighAvailable.role, 'main');
  });
});

