import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LlmAuthError } from '../../../src/domain/agent/errors/llm.auth.error.ts';
import { LlmProtocolError } from '../../../src/domain/agent/errors/llm.protocol.error.ts';
import { LlmRateLimitedError } from '../../../src/domain/agent/errors/llm.rate.limited.error.ts';
import { LlmUnavailableError } from '../../../src/domain/agent/errors/llm.unavailable.error.ts';
import { type LlmEvent } from '../../../src/app/agent/ports/llm/llm.event.ts';
import { mapStream } from '../../../src/libs/llm/openai-compat/map.stream.ts';
import { asAsync, chunkEvent, DONE_EVENT, textChunk } from './support/sse.events.ts';

async function run(...events: ReturnType<typeof chunkEvent>[]): Promise<LlmEvent[]> {
  const out: LlmEvent[] = [];
  for await (const event of mapStream(asAsync(events))) out.push(event);
  return out;
}

describe('mapStream', () => {
  it('texto em varios chunks, uso com custo e fim; usage antes do finish', async () => {
    const out = await run(
      chunkEvent(textChunk('Ola, ')),
      chunkEvent(textChunk('mundo', 'stop')),
      chunkEvent({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 3, prompt_tokens_details: { cached_tokens: 8 }, cost: 0.0042 } }),
      DONE_EVENT,
    );
    assert.deepEqual(out, [
      { type: 'text_delta', text: 'Ola, ' },
      { type: 'text_delta', text: 'mundo' },
      { type: 'usage', inputTokens: 12, outputTokens: 3, cachedTokens: 8, costMicroUsd: 4200 },
      { type: 'finish', reason: 'stop' },
    ]);
  });

  it('ferramenta: chamada completa so aparece no fim, antes do finish', async () => {
    const out = await run(
      chunkEvent({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'q', arguments: '{"a"' } }] } }] }),
      chunkEvent({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':1}' } }] }, finish_reason: 'tool_calls' }] }),
      DONE_EVENT,
    );
    assert.deepEqual(out, [
      { type: 'tool_call', id: 'c1', name: 'q', args: { a: 1 } },
      { type: 'finish', reason: 'tool_calls' },
    ]);
  });

  it('argumentos invalidos viram tool_call com argsError', async () => {
    const out = await run(
      chunkEvent({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'q', arguments: '{"a": ???' } }] }, finish_reason: 'tool_calls' }] }),
      DONE_EVENT,
    );
    assert.equal(out[0]?.type, 'tool_call');
    assert.equal((out[0] as { args: unknown }).args, null);
    assert.ok((out[0] as { argsError?: string }).argsError);
  });

  it('[DONE] sem finish_reason fecha com stop (ou tool_calls se houve ferramenta) e sem uso', async () => {
    const plain = await run(chunkEvent(textChunk('x')), DONE_EVENT);
    assert.deepEqual(plain.at(-1), { type: 'finish', reason: 'stop' });
    assert.equal(plain.some((e) => e.type === 'usage'), false);
    const withTool = await run(chunkEvent({ choices: [{ delta: { tool_calls: [{ function: { name: 'q', arguments: '{}' } }] } }] }), DONE_EVENT);
    assert.deepEqual(withTool.at(-1), { type: 'finish', reason: 'tool_calls' });
  });

  it('mapeia length e content_filter', async () => {
    assert.deepEqual((await run(chunkEvent(textChunk('x', 'length')), DONE_EVENT)).at(-1), { type: 'finish', reason: 'length' });
    assert.deepEqual((await run(chunkEvent(textChunk('x', 'content_filter')), DONE_EVENT)).at(-1), { type: 'finish', reason: 'content_filter' });
  });

  it('raciocinio vira reasoning_delta e reasoning_details vira provider_state', async () => {
    const out = await run(
      chunkEvent({ choices: [{ delta: { reasoning: 'pensando', reasoning_details: [{ type: 'reasoning.text', text: 'pensando' }] } }] }),
      chunkEvent(textChunk('ok', 'stop')),
      DONE_EVENT,
    );
    assert.deepEqual(out.map((e) => e.type), ['reasoning_delta', 'text_delta', 'provider_state', 'finish']);
  });

  it('texto vazio nao gera evento', async () => {
    const out = await run(chunkEvent(textChunk('')), chunkEvent(textChunk('a', 'stop')), DONE_EVENT);
    assert.deepEqual(out.filter((e) => e.type === 'text_delta').length, 1);
  });

  it('erro dentro do stream antes de conteudo: erro mapeado, emittedContent falso', async () => {
    await assert.rejects(run(chunkEvent({ error: { code: 429, message: 'devagar' } })), (e: unknown) => {
      assert.ok(e instanceof LlmRateLimitedError);
      assert.equal(e.emittedContent, false);
      return true;
    });
  });

  it('erro dentro do stream depois de conteudo marca emittedContent', async () => {
    await assert.rejects(run(chunkEvent(textChunk('parcial')), chunkEvent({ error: { code: 401, message: 'chave' } })), (e: unknown) => {
      assert.ok(e instanceof LlmAuthError);
      assert.equal(e.emittedContent, true);
      return true;
    });
  });

  it('chunk que nao e JSON ou fora do formato e erro de protocolo', async () => {
    await assert.rejects(mapAll([{ event: 'message', data: 'nao-json', id: null, retry: null }]), LlmProtocolError);
    await assert.rejects(run(chunkEvent({ choices: 'x' })), LlmProtocolError);
  });

  it('corpo encerrado sem resposta e indisponibilidade (retentavel)', async () => {
    await assert.rejects(run(), (e: unknown) => {
      assert.ok(e instanceof LlmUnavailableError);
      assert.equal(e.emittedContent, false);
      return true;
    });
  });

  it('corpo encerrado com texto completo mas sem finish_reason nem [DONE] e aceito (FR-016)', async () => {
    const out = await run(chunkEvent(textChunk('resposta completa')));
    assert.deepEqual(out, [
      { type: 'text_delta', text: 'resposta completa' },
      { type: 'finish', reason: 'stop' },
    ]);
    const withTool = await run(chunkEvent({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'q', arguments: '{}' } }] } }] }));
    assert.deepEqual(withTool.at(-1), { type: 'finish', reason: 'tool_calls' });
  });

  it('fim sem motivo com chamada de ferramenta cortada no meio e erro de etapa fim_inesperado', async () => {
    await assert.rejects(
      run(chunkEvent({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'q', arguments: '{"a": "x' } }] } }] })),
      (e: unknown) => {
        assert.ok(e instanceof LlmProtocolError);
        assert.equal(e.stage, 'fim_inesperado');
        assert.equal(e.code, 'LLM_PROTOCOL_END');
        assert.equal(e.emittedContent, true);
        return true;
      },
    );
  });

  it('chunk invalido: etapa chunk_invalido e campo sem valor na mensagem tecnica (FR-017)', async () => {
    await assert.rejects(run(chunkEvent({ choices: [{ delta: { content: 12345678 } }] })), (e: unknown) => {
      assert.ok(e instanceof LlmProtocolError);
      assert.equal(e.stage, 'chunk_invalido');
      assert.match(e.message, /choices\.0\.delta\.content/);
      assert.equal(e.message.includes('12345678'), false);
      return true;
    });
    await assert.rejects(mapAll([{ event: 'message', data: 'segredo-nao-json', id: null, retry: null }]), (e: unknown) => {
      assert.ok(e instanceof LlmProtocolError);
      assert.equal(e.stage, 'chunk_invalido');
      assert.equal(e.message.includes('segredo'), false);
      return true;
    });
  });

  it('tolerancia: campos extras, role/index/id ausentes, usage no meio, [DONE] repetido, conteudo em partes (FR-015)', async () => {
    const out = await run(
      chunkEvent({ id: 'x', object: 'chat.completion.chunk', model: 'm', choices: [{ index: 0, delta: { role: 'assistant', content: '', refusal: null, extra: { a: 1 } }, logprobs: null }], system_fingerprint: 'f' }),
      chunkEvent({ choices: [{ delta: { role: 'assistant', content: [{ type: 'text', text: 'Ola ' }, { type: 'image', url: 'x' }] } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, novo: true } }),
      chunkEvent({ choices: [{ delta: { content: 'mundo' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 2 } }),
      chunkEvent({ choices: [], usage: { prompt_tokens: 7, completion_tokens: 3 } }),
      DONE_EVENT,
      DONE_EVENT,
    );
    assert.deepEqual(out, [
      { type: 'text_delta', text: 'Ola ' },
      { type: 'text_delta', text: 'mundo' },
      { type: 'usage', inputTokens: 7, outputTokens: 3 },
      { type: 'finish', reason: 'stop' },
    ]);
  });

  it('finish_reason stop com tool_calls presentes e aceito e a chamada sai (FR-019)', async () => {
    const out = await run(
      chunkEvent({ choices: [{ delta: { tool_calls: [{ id: 'c1', function: { name: 'q', arguments: '{}' } }] }, finish_reason: 'stop' }] }),
      DONE_EVENT,
    );
    assert.deepEqual(out.map((e) => e.type), ['tool_call', 'finish']);
    assert.deepEqual(out.at(-1), { type: 'finish', reason: 'stop' });
  });
});

async function mapAll(events: { event: string; data: string; id: null; retry: null }[]): Promise<LlmEvent[]> {
  const out: LlmEvent[] = [];
  for await (const event of mapStream(asAsync(events))) out.push(event);
  return out;
}
