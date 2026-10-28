import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LlmAuthError } from '../../../src/domain/agent/errors/llm.auth.error.ts';
import { LlmQuotaError } from '../../../src/domain/agent/errors/llm.quota.error.ts';
import { LlmRateLimitedError } from '../../../src/domain/agent/errors/llm.rate.limited.error.ts';
import { listModels } from '../../../src/libs/llm/openai-compat/list.models.ts';
import { mapHttpError } from '../../../src/libs/llm/openai-compat/map.http.error.ts';
import { normalizeModelId } from '../../../src/libs/llm/openai-compat/google.quirks.ts';
import { ToolCallAccumulator } from '../../../src/libs/llm/openai-compat/tool.call.accumulator.ts';

const NOW = new Date('2026-10-23T12:00:00Z');
const http = (status: number, body: unknown) => mapHttpError({ status, bodyText: JSON.stringify(body), retryAfterHeader: null, now: NOW, emittedContent: false });

describe('particularidades do Google AI', () => {
  it('ids `models/...` perdem o prefixo', () => {
    assert.equal(normalizeModelId('models/gemini-3.8-flash'), 'gemini-3.8-flash');
    assert.equal(normalizeModelId('openrouter/auto'), 'openrouter/auto');
  });

  it('listModels devolve ids sem o prefixo', async () => {
    const fetchFn = () => Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'models/gemini-3.8-flash' }, { id: 'models/gemini-2.5-flash' }] }), { status: 200 }));
    const models = await listModels({ baseUrl: 'https://g.test/v1beta/openai', apiKey: 'k', fetchFn });
    assert.deepEqual(models.map((m) => m.id), ['gemini-3.8-flash', 'gemini-2.5-flash']);
  });

  it('HTTP 400 "API key not valid" (erro em lista) => chave recusada', () => {
    const error = http(400, [{ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }]);
    assert.ok(error instanceof LlmAuthError);
  });

  it('429 RESOURCE_EXHAUSTED com texto de cota => cota; 429 comum continua limite de taxa', () => {
    assert.ok(http(429, [{ error: { code: 429, message: 'You exceeded your current quota, please check your plan and billing details.' } }]) instanceof LlmQuotaError);
    assert.ok(http(429, { error: { message: 'Too many requests' } }) instanceof LlmRateLimitedError);
  });

  it('tool call sem `index` e sem `id` vira uma chamada com id gerado', () => {
    const acc = new ToolCallAccumulator();
    acc.push([{ function: { name: 'consultar', arguments: '{"mes":' } }]);
    acc.push([{ function: { arguments: '"2026-09"}' } }]);
    const calls = acc.finalize();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.id, 'call_1');
    assert.deepEqual(calls[0]?.args, { mes: '2026-09' });
  });
});
