import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { startSetupWorld, USER } from './support/setup.harness.ts';

describe('GetSetupViewUseCase', () => {
  it('sem perfil: abre no provedor recomendado, sem modelo, e lista os 3 provedores no desktop', async () => {
    const w = await startSetupWorld({ kind: 'openrouter' });
    try {
      const view = await w.getView.execute(USER);
      assert.equal(view.provider, 'openrouter');
      assert.equal(view.configured, false);
      assert.equal(view.model, null);
      assert.deepEqual(view.providers.map((p) => p.id), ['openrouter', 'google', 'ollama']);
      assert.equal(view.providers[0]?.defaultModel, 'openrouter/auto');
      assert.equal(view.consentGiven, false);
    } finally {
      await w.close();
    }
  });

  it('Android: sem Ollama; "somente local": nuvem desabilitada', async () => {
    const w = await startSetupWorld({ kind: 'openrouter', platform: 'android' });
    try {
      assert.deepEqual((await w.getView.execute(USER)).providers.map((p) => p.id), ['openrouter', 'google']);
      await w.settings.write(USER, { profiles: [], localOnly: true, limits: { maxSteps: 12, maxMs: 60_000, maxCostMicroUsd: 100_000 } });
      const view = await w.getView.execute(USER);
      assert.equal(view.localOnly, true);
      assert.ok(view.providers.every((p) => p.disabledReason === 'local_only'));
    } finally {
      await w.close();
    }
  });

  it('deduz o provedor e marca modelo personalizado sem regravar nada', async () => {
    const w = await startSetupWorld({ kind: 'openrouter' });
    try {
      await w.settings.write(USER, { profiles: [{ id: 'main', role: 'main', origin: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet', enabled: true, apiKey: 'k' }], localOnly: false, limits: { maxSteps: 12, maxMs: 60_000, maxCostMicroUsd: 100_000 } });
      const view = await w.getView.execute(USER);
      assert.equal(view.provider, 'openrouter');
      assert.equal(view.model, 'anthropic/claude-sonnet');
      assert.equal(view.isCustomModel, true);
      assert.equal(view.hasKey, true);
      assert.ok(!JSON.stringify(view).includes('"k"'));
      await w.settings.write(USER, { profiles: [{ id: 'main', role: 'main', origin: 'google', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.8-flash', enabled: true }], localOnly: false, limits: { maxSteps: 12, maxMs: 60_000, maxCostMicroUsd: 100_000 } });
      const google = await w.getView.execute(USER);
      assert.equal(google.provider, 'google');
      assert.equal(google.isCustomModel, false);
      await w.settings.write(USER, { profiles: [{ id: 'main', role: 'main', origin: 'openai_compat_local', baseUrl: 'http://localhost:8080/v1', model: 'x', enabled: true }], localOnly: false, limits: { maxSteps: 12, maxMs: 60_000, maxCostMicroUsd: 100_000 } });
      assert.equal((await w.getView.execute(USER)).provider, 'custom');
    } finally {
      await w.close();
    }
  });
});
