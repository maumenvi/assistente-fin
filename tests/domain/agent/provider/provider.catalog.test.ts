import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectProvider } from '../../../../src/domain/agent/provider/detect.provider.ts';
import { listProvidersFor } from '../../../../src/domain/agent/provider/list.providers.for.ts';
import { PROVIDERS } from '../../../../src/domain/agent/provider/provider.catalog.ts';
import { PROVIDER_IDS } from '../../../../src/domain/agent/provider/provider.id.ts';
import { recommendedModels } from '../../../../src/domain/agent/provider/recommended.models.ts';
import { requiresCloudConsent } from '../../../../src/domain/agent/requires.cloud.consent.ts';

describe('catalogo de provedores', () => {
  it('todo provedor e coerente: chave so na nuvem, guia existente, modelos preferidos', () => {
    for (const id of PROVIDER_IDS) {
      const p = PROVIDERS[id];
      assert.equal(p.id, id);
      assert.equal(p.needsKey, requiresCloudConsent(p.origin), `${id}: chave <=> nuvem`);
      assert.ok(PROVIDER_IDS.includes(p.guideId));
      assert.ok(p.allowedHosts.length > 0);
      assert.ok(recommendedModels(id).length > 0);
    }
  });

  it('o Android nunca recebe o Ollama; o desktop recebe os tres', () => {
    assert.deepEqual(listProvidersFor('android', { localOnly: false }).map((c) => c.provider.id), ['openrouter', 'google']);
    assert.equal(listProvidersFor('desktop', { localOnly: false }).length, 3);
  });

  it('"somente local" desabilita a nuvem com o motivo', () => {
    const choices = listProvidersFor('desktop', { localOnly: true });
    assert.deepEqual(choices.map((c) => [c.provider.id, c.disabledReason]), [['openrouter', 'local_only'], ['google', 'local_only'], ['ollama', null]]);
  });

  it('detectProvider reconhece os perfis das specs 031-033 e nunca lanca', () => {
    assert.equal(detectProvider({ origin: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' }), 'openrouter');
    assert.equal(detectProvider({ origin: 'google', baseUrl: PROVIDERS.google.baseUrl }), 'google');
    assert.equal(detectProvider({ origin: 'openai_compat_local', baseUrl: 'http://localhost:11434/v1' }), 'ollama');
    assert.equal(detectProvider({ origin: 'openai_compat_local', baseUrl: 'http://localhost:8080/v1' }), 'custom');
    assert.equal(detectProvider({ origin: 'openai_compat_local', baseUrl: 'lixo' }), 'custom');
  });
});
