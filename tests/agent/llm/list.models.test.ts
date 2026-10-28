import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { LlmAuthError } from '../../../src/domain/agent/errors/llm.auth.error.ts';
import { LlmUnavailableError } from '../../../src/domain/agent/errors/llm.unavailable.error.ts';
import { listedModelCapabilities, listModels, MODEL_LIST_TTL_MS, type ModelListCache } from '../../../src/libs/llm/openai-compat/list.models.ts';
import { startLocalLlmServer, type LocalLlmServer } from './support/local.llm.server.ts';

let server: LocalLlmServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

const OPENROUTER_LIKE = {
  data: [
    {
      id: 'anthropic/claude-sonnet', context_length: 200000, supported_parameters: ['tools', 'response_format'],
      architecture: { input_modalities: ['text', 'image'] }, pricing: { prompt: '0.000003', completion: '0.000015' },
    },
    { id: 'meta/modelo-sem-ferramentas', context_length: 8192, supported_parameters: ['temperature'], architecture: { input_modalities: ['text'] } },
  ],
};

describe('listModels', () => {
  it('le a lista, infere capacidades e precos', async () => {
    server = await startLocalLlmServer((req, res) => {
      assert.equal(req.headers['authorization'], 'Bearer chave-x');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(OPENROUTER_LIKE));
    });
    const models = await listModels({ baseUrl: server.baseUrl, apiKey: 'chave-x', fetchFn: fetch });
    assert.equal(models.length, 2);
    const [sonnet, plain] = models;
    assert.deepEqual(sonnet && listedModelCapabilities(sonnet), { contextWindow: 200000, tools: true, structuredOutput: true, vision: true });
    assert.equal(sonnet?.promptPriceUsd, 0.000003);
    assert.equal(plain?.supportsTools, false);
    assert.equal(plain?.vision, false);
  });

  it('servidor local so com id: o resto fica null (nada afirmado)', async () => {
    server = await startLocalLlmServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'llama3.1:8b' }] }));
    });
    const [model] = await listModels({ baseUrl: server.baseUrl, fetchFn: fetch });
    assert.deepEqual(model && listedModelCapabilities(model), {});
    assert.equal(model?.supportsTools, null);
  });

  it('404 (servidor sem /models) devolve lista vazia', async () => {
    server = await startLocalLlmServer((_req, res) => { res.writeHead(404).end(); });
    assert.deepEqual(await listModels({ baseUrl: server.baseUrl, fetchFn: fetch }), []);
  });

  it('resposta que nao e a lista devolve vazio', async () => {
    server = await startLocalLlmServer((_req, res) => { res.writeHead(200).end('<html>'); });
    assert.deepEqual(await listModels({ baseUrl: server.baseUrl, fetchFn: fetch }), []);
  });

  it('401 vira LlmAuthError', async () => {
    server = await startLocalLlmServer((_req, res) => { res.writeHead(401).end(JSON.stringify({ error: { message: 'x' } })); });
    await assert.rejects(listModels({ baseUrl: server.baseUrl, fetchFn: fetch }), LlmAuthError);
  });

  it('servidor fora do ar vira LlmUnavailableError', async () => {
    server = await startLocalLlmServer((_req, res) => { res.end(); });
    const { baseUrl } = server;
    await server.close();
    server = null;
    await assert.rejects(listModels({ baseUrl, fetchFn: fetch }), LlmUnavailableError);
  });

  it('cache por baseUrl valido por 24 h', async () => {
    server = await startLocalLlmServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(OPENROUTER_LIKE));
    });
    const cache: ModelListCache = new Map();
    let now = 1_000;
    const params = { baseUrl: server.baseUrl, fetchFn: fetch, cache, nowMs: () => now };
    await listModels(params);
    await listModels(params);
    assert.equal(server.requests.length, 1);
    now += MODEL_LIST_TTL_MS - 1;
    await listModels(params);
    assert.equal(server.requests.length, 1);
    now += 2;
    await listModels(params);
    assert.equal(server.requests.length, 2);
  });
});
