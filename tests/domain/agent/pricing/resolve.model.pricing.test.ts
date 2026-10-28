import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateStepCost, microUsdToBrlString } from '../../../../src/domain/agent/pricing/calculate.step.cost.ts';
import { resolveModelPricing } from '../../../../src/domain/agent/pricing/resolve.model.pricing.ts';

describe('resolveModelPricing & calculateStepCost (spec 038)', () => {
  it('modelos locais (openai_compat_local) tem custo zero por padrao', () => {
    const pricing = resolveModelPricing('openai_compat_local', 'qwen2.5:7b');
    assert.equal(pricing.inputMicroUsdPer1M, 0);
    assert.equal(pricing.outputMicroUsdPer1M, 0);
    assert.equal(calculateStepCost({ inputTokens: 50_000, outputTokens: 10_000 }, pricing), 0);
  });

  it('resolve precos pre-configurados para Claude Sonnet, Gemini Flash e GPT-4.1', () => {
    const sonnet = resolveModelPricing('openrouter', 'anthropic/claude-3-7-sonnet');
    assert.equal(sonnet.inputMicroUsdPer1M, 3_000_000);
    assert.equal(sonnet.outputMicroUsdPer1M, 15_000_000);

    const flash = resolveModelPricing('google', 'gemini-2.5-flash');
    assert.equal(flash.inputMicroUsdPer1M, 150_000);
    assert.equal(flash.outputMicroUsdPer1M, 600_000);

    // 10.000 input + 2.000 output no Sonnet = 30.000 + 30.000 = 60.000 micro-USD (US$ 0,06)
    const cost = calculateStepCost({ inputTokens: 10_000, outputTokens: 2_000 }, sonnet);
    assert.equal(cost, 60_000);
  });

  it('permite sobrescrever com tabela customizada pelo usuario', () => {
    const custom = { inputMicroUsdPer1M: 500_000, outputMicroUsdPer1M: 1_500_000 };
    const resolved = resolveModelPricing('openrouter', 'anthropic/claude-3-7-sonnet', custom);
    assert.deepEqual(resolved, custom);
  });

  it('formata micro-dolares em Reais (R$)', () => {
    assert.equal(microUsdToBrlString(100_000, 5.5), 'R$ 0,55');
    assert.equal(microUsdToBrlString(0, 5.5), 'R$ 0,00');
  });
});

