import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listModels } from '../../src/libs/llm/openai-compat/list.models.ts';
import { probeToolSupport } from '../../src/libs/llm/openai-compat/probe.tool.support.ts';
import { probeContext } from '../../src/libs/llm/openai-compat/probe.context.ts';
import { ollamaContextLength } from '../../src/libs/llm/providers/ollama.process.info.ts';
import { openRouterKeyInfo } from '../../src/libs/llm/providers/openrouter.key.info.ts';
import { LlmAuthError } from '../../src/domain/agent/errors/llm.auth.error.ts';
import { startFakeProvider } from './fake.provider.servers.ts';

describe('servidores de mentira dos provedores', () => {
  it('OpenRouter: lista, chave, sonda de ferramentas e chave errada', async () => {
    const s = await startFakeProvider({ kind: 'openrouter', supportsTools: (m) => m !== 'sem/ferramentas', models: ['openrouter/auto', 'sem/ferramentas'] });
    try {
      assert.equal((await listModels({ baseUrl: s.baseUrl, apiKey: 'good-key', fetchFn: fetch })).length, 2);
      assert.equal((await openRouterKeyInfo({ baseUrl: s.baseUrl, apiKey: 'good-key', fetchFn: fetch })).remainingUsd, 4.5);
      assert.equal((await probeToolSupport({ baseUrl: s.baseUrl, apiKey: 'good-key', model: 'openrouter/auto', fetchFn: fetch })).supportsTools, true);
      assert.equal((await probeToolSupport({ baseUrl: s.baseUrl, apiKey: 'good-key', model: 'sem/ferramentas', fetchFn: fetch })).supportsTools, false);
      await assert.rejects(listModels({ baseUrl: s.baseUrl, apiKey: 'ruim', fetchFn: fetch }), LlmAuthError);
    } finally {
      await s.close();
    }
  });

  it('Google: ids `models/`, erro 400 em lista vira chave recusada', async () => {
    const s = await startFakeProvider({ kind: 'google' });
    try {
      assert.deepEqual((await listModels({ baseUrl: s.baseUrl, apiKey: 'good-key', fetchFn: fetch })).map((m) => m.id), ['gemini-3.8-flash']);
      await assert.rejects(listModels({ baseUrl: s.baseUrl, apiKey: 'ruim', fetchFn: fetch }), LlmAuthError);
    } finally {
      await s.close();
    }
  });

  it('Ollama: /api/ps e truncamento de contexto na sonda de enchimento', async () => {
    const s = await startFakeProvider({ kind: 'ollama', contextTokens: 4096 });
    try {
      assert.equal(await ollamaContextLength({ baseUrl: s.baseUrl, model: 'qwen3:8b', fetchFn: fetch }), 4096);
      assert.equal(await probeContext({ baseUrl: s.baseUrl, model: 'qwen3:8b', fetchFn: fetch }), 4096);
    } finally {
      await s.close();
    }
  });
});
