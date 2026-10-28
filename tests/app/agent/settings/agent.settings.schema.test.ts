import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONSERVATIVE_CAPABILITIES } from '../../../../src/domain/agent/conservative.capabilities.ts';
import { DEFAULT_RUN_BUDGET } from '../../../../src/domain/agent/default.run.budget.ts';
import { agentSettingsInputSchema } from '../../../../src/app/agent/settings/agent.settings.input.schema.ts';
import { agentSettingsSchema } from '../../../../src/app/agent/settings/agent.settings.schema.ts';
import { applySettingsInput } from '../../../../src/app/agent/settings/apply.settings.input.ts';
import { toAgentSettingsView } from '../../../../src/app/agent/settings/to.agent.settings.view.ts';

describe('agent.settings.schema & applySettingsInput (spec 038)', () => {
  it('aceita maxTokens por pedido, limites e preco por perfil e routingStrategy', () => {
    const parsed = agentSettingsSchema.parse({
      profiles: [
        {
          id: 'p-high',
          role: 'main',
          origin: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          model: 'anthropic/claude-3.5-sonnet',
          keyRef: 'secret:high',
          capabilities: CONSERVATIVE_CAPABILITIES,
          enabled: true,
          limits: { maxSteps: 20, maxMs: 90_000, maxCostMicroUsd: 300_000, maxTokens: 32_000 },
          pricing: { inputMicroUsdPer1M: 3_000_000, outputMicroUsdPer1M: 15_000_000 },
        },
      ],
      localOnly: false,
      limits: { ...DEFAULT_RUN_BUDGET, maxTokens: 24_000 },
      routingStrategy: 'hybrid_3_tiers',
    });

    assert.equal(parsed.routingStrategy, 'hybrid_3_tiers');
    assert.equal(parsed.limits.maxTokens, 24_000);
    assert.equal(parsed.profiles[0]?.limits?.maxTokens, 32_000);
    assert.equal(parsed.profiles[0]?.pricing?.inputMicroUsdPer1M, 3_000_000);
  });

  it('permite apagar chave existente via clearKey e preserva routingStrategy no view', async () => {
    const store = new Map<string, string>([['agent-api-key:u1:p1', 'sk-old']]);
    const secrets = {
      get: async (ref: string) => store.get(ref) ?? null,
      set: async (ref: string, val: string) => {
        store.set(ref, val);
      },
      delete: async (ref: string) => {
        store.delete(ref);
      },
    };

    const current = {
      profiles: [
        {
          id: 'p1',
          role: 'main' as const,
          origin: 'openrouter' as const,
          baseUrl: 'https://openrouter.ai/api/v1',
          model: 'openai/gpt-4o-mini',
          keyRef: 'agent-api-key:u1:p1',
          capabilities: CONSERVATIVE_CAPABILITIES,
          enabled: true,
        },
      ],
      localOnly: false,
      limits: DEFAULT_RUN_BUDGET,
    };

    const input = agentSettingsInputSchema.parse({
      profiles: [
        {
          id: 'p1',
          role: 'main',
          origin: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          model: 'openai/gpt-4o-mini',
          enabled: true,
          clearKey: true,
        },
      ],
      localOnly: false,
      limits: DEFAULT_RUN_BUDGET,
      routingStrategy: 'progressive_escalation',
    });

    const updated = await applySettingsInput('u1', current, input, secrets);
    assert.equal(updated.profiles[0]?.keyRef, null);
    assert.equal(store.has('agent-api-key:u1:p1'), false);
    assert.equal(updated.routingStrategy, 'progressive_escalation');

    const view = toAgentSettingsView(updated, (ref) => store.has(ref));
    assert.equal(view.profiles[0]?.hasKey, false);
    assert.equal(view.routingStrategy, 'progressive_escalation');
  });
});
