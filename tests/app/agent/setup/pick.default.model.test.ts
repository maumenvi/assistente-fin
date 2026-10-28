import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickDefaultModel } from '../../../../src/app/agent/setup/pick.default.model.ts';
import { PROVIDERS } from '../../../../src/domain/agent/provider/provider.catalog.ts';
import { listModels } from '../../../../src/libs/llm/openai-compat/list.models.ts';
import { startFakeProvider, type FakeProviderOptions } from '../../../support/fake.provider.servers.ts';

async function pick(options: FakeProviderOptions, provider: keyof typeof PROVIDERS) {
  const server = await startFakeProvider(options);
  try {
    const listed = await listModels({ baseUrl: server.baseUrl, apiKey: 'good-key', fetchFn: fetch });
    return await pickDefaultModel({ provider: PROVIDERS[provider], baseUrl: server.baseUrl, apiKey: 'good-key', fetchFn: fetch, listed });
  } finally {
    await server.close();
  }
}

describe('pickDefaultModel (padrao provado pela sonda)', () => {
  it('OpenRouter: o auto, quando passa na sonda de ferramentas', async () => {
    const picked = await pick({ kind: 'openrouter' }, 'openrouter');
    assert.equal(picked.model, 'openrouter/auto');
    assert.equal(picked.supportsTools, true);
    assert.equal(picked.replaced, false);
  });

  it('OpenRouter: o auto sem ferramentas cai para a lista curta', async () => {
    const picked = await pick({ kind: 'openrouter', supportsTools: (m) => m !== 'openrouter/auto' }, 'openrouter');
    assert.equal(picked.model, 'google/gemini-2.5-flash');
    assert.equal(picked.supportsTools, true);
  });

  it('OpenRouter: padrao some da listagem => substituto e `replaced`', async () => {
    const picked = await pick({ kind: 'openrouter', models: ['openai/gpt-4o-mini'], supportsTools: (m) => m !== 'openrouter/auto' }, 'openrouter');
    assert.equal(picked.model, 'openai/gpt-4o-mini');
    assert.equal(picked.replaced, true);
  });

  it('nenhum candidato serve => model null', async () => {
    const picked = await pick({ kind: 'openrouter', supportsTools: () => false }, 'openrouter');
    assert.equal(picked.model, null);
    assert.equal(picked.supportsTools, false);
  });

  it('Google: gemini padrao (id sem o prefixo models/)', async () => {
    const picked = await pick({ kind: 'google' }, 'google');
    assert.equal(picked.model, 'gemini-3.8-flash');
  });

  it('Ollama: o melhor instalado com ferramentas; ignora modelos < 7B', async () => {
    const picked = await pick({ kind: 'ollama', models: ['llama3.2:3b', 'llama3.1:8b', 'qwen3:8b'] }, 'ollama');
    assert.equal(picked.model, 'qwen3:8b');
  });

  it('Ollama sem modelo que sirva => null e o comando de instalar', async () => {
    const picked = await pick({ kind: 'ollama', models: ['llama3.2:3b'] }, 'ollama');
    assert.equal(picked.model, null);
    assert.equal(picked.suggestedCommand, 'ollama pull qwen3:8b');
  });
});
