import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SaveTierProfileUseCase } from '../../../../src/app/agent/use-cases/save.tier.profile.use.case.ts';
import { ReorderTiersUseCase } from '../../../../src/app/agent/use-cases/reorder.tiers.use.case.ts';
import { MemoryAgentSettings } from '../../../../src/app/agent/settings/memory.agent.settings.ts';
import { MemorySecretStore } from '../../../../src/app/agent/settings/memory.secret.store.ts';
import { SystemClock } from '../../../../src/libs/clock/system.clock.ts';
import { type AgentSettings } from '../../../../src/app/agent/ports/settings/agent.settings.ts';

async function createFixture(initial?: Partial<AgentSettings>) {
  const secrets = new MemorySecretStore();
  const settings = new MemoryAgentSettings(secrets);
  if (initial) {
    await settings.write('user-1', {
      profiles: (initial.profiles ?? []).map((p) => ({
        id: p.id,
        role: p.role,
        origin: p.origin,
        baseUrl: p.baseUrl,
        model: p.model,
        enabled: p.enabled ?? true,
        apiKey: (p as any).apiKey,
        capabilities: p.capabilities,
      })),
      localOnly: initial.localOnly ?? false,
      limits: initial.limits ?? { maxSteps: 12, maxMs: 60000, maxCostMicroUsd: 1_000_000 },
    });
  }
  const clock = new SystemClock();
  return { settings, secrets, clock };
}

test('SaveTierProfileUseCase atualiza e testa um único tier preservando os demais (spec 039, FR-008)', async () => {
  const { settings, secrets, clock } = await createFixture({
    profiles: [
      { id: 'main', role: 'main', origin: 'google', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-1.5-pro', keyRef: 'k-main', apiKey: 'key-gemini', capabilities: { toolSupport: true, streaming: true, verifiedAt: new Date() } },
      { id: 'fast', role: 'fast', origin: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/auto', keyRef: 'k-fast', apiKey: 'key-openrouter', capabilities: { toolSupport: true, streaming: true, verifiedAt: new Date() } },
      { id: 'fallback', role: 'fallback', origin: 'openai_compat_local', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:latest', keyRef: null, capabilities: { toolSupport: true, streaming: true, verifiedAt: new Date() } },
    ] as any,
  });

  const useCase = new SaveTierProfileUseCase({
    settings,
    secrets,
    clock,
    testConnection: async (_opts) => ({ ok: true, latencyMs: 85, toolSupport: true }),
  });

  // Salvar apenas o 2º Médio com novo modelo
  const result = await useCase.execute({
    userId: 'user-1',
    role: 'fast',
    origin: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3-haiku',
    apiKey: 'new-key-openrouter',
  });

  assert.equal(result.ok, true);
  assert.equal(result.role, 'fast');
  assert.equal(result.connectionTest.ok, true);
  assert.equal(result.connectionTest.latencyMs, 85);

  const updated = await settings.read('user-1');
  const fastProfile = updated.profiles.find((p) => p.role === 'fast');
  assert.equal(fastProfile?.model, 'anthropic/claude-3-haiku');
  assert.equal(await secrets.get(fastProfile?.keyRef ?? ''), 'new-key-openrouter');

  // Main e Fallback permanecem inalterados
  const mainProfile = updated.profiles.find((p) => p.role === 'main');
  assert.equal(mainProfile?.model, 'gemini-1.5-pro');
  const fallbackProfile = updated.profiles.find((p) => p.role === 'fallback');
  assert.equal(fallbackProfile?.model, 'qwen2.5:latest');
});

test('ReorderTiersUseCase reordena os perfis atomically com suas chaves e modelos intactos (spec 039, FR-005)', async () => {
  const { settings, secrets } = await createFixture({
    profiles: [
      { id: 'main', role: 'main', origin: 'google', baseUrl: 'https://gemini.api', model: 'gemini-1.5-pro', keyRef: 'k-main', apiKey: 'key-gemini', capabilities: { toolSupport: true, streaming: true, verifiedAt: null } },
      { id: 'fast', role: 'fast', origin: 'openrouter', baseUrl: 'https://openrouter.ai', model: 'openrouter/auto', keyRef: 'k-fast', apiKey: 'key-openrouter', capabilities: { toolSupport: true, streaming: true, verifiedAt: null } },
      { id: 'fallback', role: 'fallback', origin: 'openai_compat_local', baseUrl: 'http://localhost:11434', model: 'qwen2.5:latest', keyRef: null, capabilities: { toolSupport: true, streaming: true, verifiedAt: null } },
    ] as any,
  });

  const reorderUseCase = new ReorderTiersUseCase({ settings, secrets });

  // Mover fast para a primeira posição (1º Alto)
  const result = await reorderUseCase.execute({
    userId: 'user-1',
    rolesOrder: ['fast', 'main', 'fallback'],
  });

  assert.equal(result.ok, true);

  const updated = await settings.read('user-1');
  // O novo 'main' deve ter o modelo openrouter/auto e a chave key-openrouter
  const newMain = updated.profiles.find((p) => p.role === 'main');
  assert.equal(newMain?.model, 'openrouter/auto');
  assert.equal(newMain?.origin, 'openrouter');
  assert.equal(await secrets.get(newMain?.keyRef ?? ''), 'key-openrouter');

  // O novo 'fast' deve ter o modelo gemini-1.5-pro e a chave key-gemini
  const newFast = updated.profiles.find((p) => p.role === 'fast');
  assert.equal(newFast?.model, 'gemini-1.5-pro');
  assert.equal(newFast?.origin, 'google');
  assert.equal(await secrets.get(newFast?.keyRef ?? ''), 'key-gemini');
});
