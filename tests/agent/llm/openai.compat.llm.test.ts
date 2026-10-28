import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { LlmAuthError } from '../../../src/domain/agent/errors/llm.auth.error.ts';
import { LlmProtocolError } from '../../../src/domain/agent/errors/llm.protocol.error.ts';
import { LlmRateLimitedError } from '../../../src/domain/agent/errors/llm.rate.limited.error.ts';
import { LlmUnavailableError } from '../../../src/domain/agent/errors/llm.unavailable.error.ts';
import { RunCancelledError } from '../../../src/domain/agent/errors/run.cancelled.error.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { type LlmEvent } from '../../../src/app/agent/ports/llm/llm.event.ts';
import { OpenAiCompatLlm } from '../../../src/libs/llm/openai-compat/openai.compat.llm.ts';
import { type OpenAiCompatOptions } from '../../../src/libs/llm/openai-compat/openai.compat.options.ts';
import { delay, sendChunk, sendDone, sendHttpError, startLocalLlmServer, startSse, type LocalLlmServer } from './support/local.llm.server.ts';
import { textChunk } from './support/sse.events.ts';

const CAPS = { ...CONSERVATIVE_CAPABILITIES, tools: true };
const REQUEST = { system: 'sys', messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'oi' }] }] };
const FAST_RETRY = { maxRetries: 2, delaysMs: [1, 1], jitter: 0, maxRetryAfterMs: 50 };

let server: LocalLlmServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

function adapter(overrides: Partial<OpenAiCompatOptions> = {}): OpenAiCompatLlm {
  return new OpenAiCompatLlm({
    baseUrl: (server as LocalLlmServer).baseUrl,
    model: 'm',
    apiKey: 'sk-test-SEGREDO123456',
    capabilities: CAPS,
    fetchFn: fetch,
    retry: FAST_RETRY,
    ...overrides,
  });
}

async function collect(iterable: AsyncIterable<LlmEvent>): Promise<LlmEvent[]> {
  const out: LlmEvent[] = [];
  for await (const event of iterable) out.push(event);
  return out;
}

describe('OpenAiCompatLlm (servidor HTTP local)', () => {
  it('texto em streaming, com cabecalhos e corpo corretos', async () => {
    server = await startLocalLlmServer((_req, res) => {
      startSse(res);
      sendChunk(res, textChunk('Ola'));
      sendChunk(res, textChunk(', mundo', 'stop'));
      sendDone(res);
    });
    const events = await collect(adapter({ extraHeaders: { 'X-Title': 'Assistente Fin' } }).stream(REQUEST));
    assert.deepEqual(events.map((e) => e.type), ['text_delta', 'text_delta', 'finish']);
    const sent = server.requests[0];
    assert.equal(sent?.method, 'POST');
    assert.equal(sent?.url, '/v1/chat/completions');
    assert.equal(sent?.headers['authorization'], 'Bearer sk-test-SEGREDO123456');
    assert.equal(sent?.headers['x-title'], 'Assistente Fin');
    assert.equal(sent?.headers['accept'], 'text/event-stream');
    const body = JSON.parse(sent?.body ?? '{}');
    assert.equal(body.stream, true);
    assert.equal(body.model, 'm');
  });

  it('servidor local nao recebe usage.include nem authorization sem chave', async () => {
    server = await startLocalLlmServer((_req, res) => {
      startSse(res);
      sendChunk(res, textChunk('x', 'stop'));
      sendDone(res);
    });
    const { apiKey: _ignored, ...rest } = {
      baseUrl: server.baseUrl, model: 'm', apiKey: undefined as string | undefined, capabilities: CAPS, fetchFn: fetch, retry: FAST_RETRY,
    };
    await collect(new OpenAiCompatLlm(rest).stream(REQUEST));
    const sent = server.requests[0];
    assert.equal(sent?.headers['authorization'], undefined);
    assert.equal('usage' in JSON.parse(sent?.body ?? '{}'), false);
  });

  it('ferramenta fragmentada vira tool_call completo', async () => {
    server = await startLocalLlmServer((_req, res) => {
      startSse(res);
      sendChunk(res, { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'q', arguments: '{"a"' } }] } }] });
      sendChunk(res, { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':1}' } }] }, finish_reason: 'tool_calls' }] });
      sendDone(res);
    });
    const events = await collect(adapter().stream(REQUEST));
    assert.deepEqual(events, [
      { type: 'tool_call', id: 'c1', name: 'q', args: { a: 1 } },
      { type: 'finish', reason: 'tool_calls' },
    ]);
  });

  it('caractere UTF-8 partido entre escritas do servidor', async () => {
    server = await startLocalLlmServer(async (_req, res) => {
      startSse(res);
      const bytes = Buffer.from(`data: ${JSON.stringify(textChunk('ação €'))}\n\n`, 'utf8');
      const cut = bytes.indexOf(0xc3) + 1;
      res.write(bytes.subarray(0, cut));
      await delay(15);
      res.write(bytes.subarray(cut));
      sendChunk(res, textChunk('', 'stop'));
      sendDone(res);
    });
    const events = await collect(adapter().stream(REQUEST));
    assert.deepEqual(events.filter((e) => e.type === 'text_delta'), [{ type: 'text_delta', text: 'ação €' }]);
  });

  it('401 nao retenta e vira LlmAuthError sem vazar a chave', async () => {
    server = await startLocalLlmServer((_req, res) => sendHttpError(res, 401, 'chave sk-test-SEGREDO123456 invalida'));
    await assert.rejects(collect(adapter().stream(REQUEST)), (error: unknown) => {
      assert.ok(error instanceof LlmAuthError);
      assert.equal(error.message.includes('SEGREDO'), false);
      return true;
    });
    assert.equal(server.requests.length, 1);
  });

  it('429 com Retry-After: retenta e depois responde', async () => {
    let calls = 0;
    server = await startLocalLlmServer((_req, res) => {
      calls += 1;
      if (calls === 1) return sendHttpError(res, 429, 'devagar', { 'retry-after': '0' });
      startSse(res);
      sendChunk(res, textChunk('ok', 'stop'));
      sendDone(res);
    });
    const events = await collect(adapter().stream(REQUEST));
    assert.equal(events.at(-1)?.type, 'finish');
    assert.equal(server.requests.length, 2);
  });

  it('429 persistente esgota as retentativas e sobe LlmRateLimitedError', async () => {
    server = await startLocalLlmServer((_req, res) => sendHttpError(res, 429, 'devagar', { 'retry-after': '0' }));
    await assert.rejects(collect(adapter().stream(REQUEST)), LlmRateLimitedError);
    assert.equal(server.requests.length, 3);
  });

  it('500 antes de conteudo e retentado', async () => {
    let calls = 0;
    server = await startLocalLlmServer((_req, res) => {
      calls += 1;
      if (calls <= 2) return sendHttpError(res, 500, 'caiu');
      startSse(res);
      sendChunk(res, textChunk('ok', 'stop'));
      sendDone(res);
    });
    const events = await collect(adapter().stream(REQUEST));
    assert.equal(events.at(-1)?.type, 'finish');
    assert.equal(server.requests.length, 3);
  });

  it('silencio entre eventos estoura o tempo ocioso e, depois de conteudo, nao retenta', async () => {
    server = await startLocalLlmServer(async (_req, res) => {
      startSse(res);
      sendChunk(res, textChunk('parcial'));
      await delay(400);
      res.end();
    });
    const seen: LlmEvent[] = [];
    await assert.rejects(
      (async () => {
        for await (const e of adapter({ timeouts: { connectMs: 1000, firstContentMs: 1000, idleMs: 60 } }).stream(REQUEST)) seen.push(e);
      })(),
      (error: unknown) => {
        assert.ok(error instanceof LlmUnavailableError);
        assert.equal(error.emittedContent, true);
        return true;
      },
    );
    assert.deepEqual(seen, [{ type: 'text_delta', text: 'parcial' }]);
    assert.equal(server.requests.length, 1);
  });

  it('nenhum conteudo dentro do tempo do primeiro conteudo: indisponivel e retentavel', async () => {
    server = await startLocalLlmServer(async (_req, res) => {
      startSse(res);
      await delay(300);
      res.end();
    });
    await assert.rejects(
      collect(adapter({ timeouts: { connectMs: 1000, firstContentMs: 50, idleMs: 1000 } }).stream(REQUEST)),
      LlmUnavailableError,
    );
    assert.equal(server.requests.length, 3);
  });

  it('cancelar no meio encerra com RunCancelledError e fecha a conexao', async () => {
    server = await startLocalLlmServer(async (_req, res) => {
      startSse(res);
      sendChunk(res, textChunk('comeco'));
      await delay(2000);
      res.end();
    });
    const controller = new AbortController();
    const seen: LlmEvent[] = [];
    await assert.rejects(
      (async () => {
        for await (const e of adapter().stream(REQUEST, controller.signal)) {
          seen.push(e);
          controller.abort();
        }
      })(),
      RunCancelledError,
    );
    assert.deepEqual(seen, [{ type: 'text_delta', text: 'comeco' }]);
    await delay(50);
    assert.equal(server.aborted.count, 1);
  });

  it('ja cancelado antes de comecar nao faz requisicao', async () => {
    server = await startLocalLlmServer((_req, res) => { res.end(); });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(collect(adapter().stream(REQUEST, controller.signal)), RunCancelledError);
    assert.equal(server.requests.length, 0);
  });

  it('servidor fora do ar vira LlmUnavailableError (e retentado)', async () => {
    server = await startLocalLlmServer((_req, res) => { res.end(); });
    const llm = adapter();
    await server.close();
    await assert.rejects(collect(llm.stream(REQUEST)), LlmUnavailableError);
  });

  it('stream ilegivel: erro de protocolo com a etapa, sem retentar e sem vazar o conteudo (spec 037)', async () => {
    server = await startLocalLlmServer((_req, res) => {
      startSse(res);
      sendChunk(res, { choices: [{ delta: { content: 12345 } }] });
      sendDone(res);
    });
    await assert.rejects(collect(adapter().stream(REQUEST)), (error: unknown) => {
      assert.ok(error instanceof LlmProtocolError);
      assert.equal(error.stage, 'chunk_invalido');
      assert.equal(error.message.includes('12345'), false);
      assert.equal(error.message.includes('SEGREDO'), false);
      return true;
    });
    assert.equal(server.requests.length, 1);
  });

  it('stream que fecha sem finish_reason nem [DONE], com texto, e aceito', async () => {
    server = await startLocalLlmServer((_req, res) => {
      startSse(res);
      sendChunk(res, textChunk('resposta inteira'));
      res.end();
    });
    const events = await collect(adapter().stream(REQUEST));
    assert.deepEqual(events, [
      { type: 'text_delta', text: 'resposta inteira' },
      { type: 'finish', reason: 'stop' },
    ]);
  });
});
