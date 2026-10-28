import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { LlmAuthError } from '../../../src/domain/agent/errors/llm.auth.error.ts';
import { LlmUnavailableError } from '../../../src/domain/agent/errors/llm.unavailable.error.ts';
import { probeToolSupport } from '../../../src/libs/llm/openai-compat/probe.tool.support.ts';
import { startLocalLlmServer, type LocalLlmServer } from './support/local.llm.server.ts';

let server: LocalLlmServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

function reply(res: import('node:http').ServerResponse, message: unknown): void {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ choices: [{ message }] }));
}

describe('probeToolSupport', () => {
  it('o modelo chamou ping com echo textual: suporta ferramentas', async () => {
    server = await startLocalLlmServer((_req, res) => {
      reply(res, { content: null, tool_calls: [{ id: 'c1', function: { name: 'ping', arguments: '{"echo":"ok"}' } }] });
    });
    const result = await probeToolSupport({ baseUrl: server.baseUrl, model: 'm', fetchFn: fetch });
    assert.equal(result.supportsTools, true);
    const sent = JSON.parse(server.requests[0]?.body ?? '{}');
    assert.equal(sent.stream, false);
    assert.equal(sent.max_tokens, 64);
    assert.equal(sent.tools[0].function.name, 'ping');
  });

  it('o modelo respondeu em texto: nao suporta', async () => {
    server = await startLocalLlmServer((_req, res) => { reply(res, { content: 'ok, pronto' }); });
    assert.equal((await probeToolSupport({ baseUrl: server.baseUrl, model: 'm', fetchFn: fetch })).supportsTools, false);
  });

  it('chamou outra ferramenta ou argumentos invalidos: nao suporta', async () => {
    server = await startLocalLlmServer((_req, res) => {
      reply(res, { tool_calls: [{ function: { name: 'outra', arguments: '{"echo":"ok"}' } }] });
    });
    assert.equal((await probeToolSupport({ baseUrl: server.baseUrl, model: 'm', fetchFn: fetch })).supportsTools, false);
    await server.close();
    server = await startLocalLlmServer((_req, res) => {
      reply(res, { tool_calls: [{ function: { name: 'ping', arguments: '{"echo": ???' } }] });
    });
    assert.equal((await probeToolSupport({ baseUrl: server.baseUrl, model: 'm', fetchFn: fetch })).supportsTools, false);
    await server.close();
    server = await startLocalLlmServer((_req, res) => {
      reply(res, { tool_calls: [{ function: { name: 'ping', arguments: '{"echo": 3}' } }] });
    });
    assert.equal((await probeToolSupport({ baseUrl: server.baseUrl, model: 'm', fetchFn: fetch })).supportsTools, false);
  });

  it('401 e erro de rede lancam o erro de dominio', async () => {
    server = await startLocalLlmServer((_req, res) => { res.writeHead(401).end(JSON.stringify({ error: { message: 'x' } })); });
    await assert.rejects(probeToolSupport({ baseUrl: server.baseUrl, model: 'm', fetchFn: fetch }), LlmAuthError);
    const { baseUrl } = server;
    await server.close();
    server = null;
    await assert.rejects(probeToolSupport({ baseUrl, model: 'm', fetchFn: fetch }), LlmUnavailableError);
  });

  it('mede a latencia com o relogio injetado', async () => {
    server = await startLocalLlmServer((_req, res) => { reply(res, { content: 'x' }); });
    let t = 100;
    const result = await probeToolSupport({ baseUrl: server.baseUrl, model: 'm', fetchFn: fetch, nowMs: () => (t += 50) });
    assert.equal(result.latencyMs, 50);
  });
});
