import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LlmAuthError } from '../../../../src/domain/agent/errors/llm.auth.error.ts';
import { probeContext } from '../../../../src/libs/llm/openai-compat/probe.context.ts';
import { ollamaContextLength } from '../../../../src/libs/llm/providers/ollama.process.info.ts';
import { openRouterKeyInfo } from '../../../../src/libs/llm/providers/openrouter.key.info.ts';

const json = (body: unknown, status = 200) => () => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('sondas por provedor', () => {
  it('OpenRouter /auth/key: limite, saldo e validade', async () => {
    const info = await openRouterKeyInfo({ baseUrl: 'https://o.test/api/v1', apiKey: 'k', fetchFn: json({ data: { limit: 5, limit_remaining: 4.5, expires_at: '2026-10-24T18:49:00Z' } }) });
    assert.deepEqual(info, { limitUsd: 5, remainingUsd: 4.5, expiresAt: '2026-10-24T18:49:00Z' });
  });
  it('OpenRouter: formato estranho => tudo null; 401 => erro de chave', async () => {
    assert.deepEqual(await openRouterKeyInfo({ baseUrl: 'https://o.test', apiKey: 'k', fetchFn: json({ x: 1 }) }), { limitUsd: null, remainingUsd: null, expiresAt: null });
    await assert.rejects(openRouterKeyInfo({ baseUrl: 'https://o.test', apiKey: 'k', fetchFn: json({ error: { message: 'x' } }, 401) }), LlmAuthError);
  });
  it('Ollama /api/ps: contexto do modelo carregado (a partir do endereco /v1)', async () => {
    let url = '';
    const fetchFn = (u: string) => { url = u; return json({ models: [{ name: 'qwen3:8b', context_length: 4096 }] })(); };
    assert.equal(await ollamaContextLength({ baseUrl: 'http://localhost:11434/v1', model: 'qwen3:8b', fetchFn }), 4096);
    assert.equal(url, 'http://localhost:11434/api/ps');
    assert.equal(await ollamaContextLength({ baseUrl: 'http://localhost:11434/v1', model: 'outro', fetchFn }), null);
    assert.equal(await ollamaContextLength({ baseUrl: 'http://localhost:11434/v1', model: 'm', fetchFn: () => Promise.reject(new Error('down')) }), null);
  });
  it('sonda de enchimento le prompt_tokens (truncado a 4096 = contexto curto)', async () => {
    let body = '';
    const fetchFn = (_u: string, init: RequestInit) => { body = String(init.body); return json({ usage: { prompt_tokens: 4096 } })(); };
    assert.equal(await probeContext({ baseUrl: 'http://localhost:11434/v1', model: 'm', fetchFn }), 4096);
    assert.ok(body.includes('"max_tokens":1'));
    assert.equal(await probeContext({ baseUrl: 'http://l', model: 'm', fetchFn: json({}) }), null);
  });
});
