import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { mapStream } from '../../../src/libs/llm/openai-compat/map.stream.ts';
import { readSseStream } from '../../../src/libs/sse/read.sse.stream.ts';
import { type LlmEvent } from '../../../src/app/agent/ports/llm/llm.event.ts';

/** Formatos de stream por provedor (spec 037, FR-015/016/018): passam pelo leitor SSE real e pelo `mapStream`. */
async function events(name: string): Promise<LlmEvent[]> {
  const bytes = readFileSync(join(import.meta.dirname, 'fixtures', name));
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
  const out: LlmEvent[] = [];
  for await (const e of mapStream(readSseStream(body))) out.push(e);
  return out;
}

const text = (list: LlmEvent[]): string => list.flatMap((e) => (e.type === 'text_delta' ? [e.text] : [])).join('');

describe('fixtures de stream por formato', () => {
  it('OpenRouter: comentario SSE, campos extras, raciocinio e uso final com custo', async () => {
    const out = await events('openrouter.text.sse');
    assert.equal(text(out), 'Ola mundo');
    assert.deepEqual(out.find((e) => e.type === 'usage'), { type: 'usage', inputTokens: 10, outputTokens: 4, cachedTokens: 0, costMicroUsd: 100 });
    assert.deepEqual(out.at(-1), { type: 'finish', reason: 'stop' });
  });

  it('Ollama: system_fingerprint e role repetido', async () => {
    const out = await events('ollama.text.sse');
    assert.equal(text(out), 'Ola mundo');
    assert.deepEqual(out.at(-1), { type: 'finish', reason: 'stop' });
  });

  it('Google (gemini-4-argon) segue coberto em gemini.thought.signature.test.ts', async () => {
    assert.ok(readFileSync(join(import.meta.dirname, 'fixtures', 'gemini-4-argon.text.sse'), 'utf8').length > 0);
  });

  it('fim sem finish_reason nem [DONE], com texto completo, e aceito', async () => {
    const out = await events('variant.no-end.sse');
    assert.equal(text(out), 'Resposta inteira');
    assert.deepEqual(out.at(-1), { type: 'finish', reason: 'stop' });
  });

  it('[DONE] repetido e ignorado', async () => {
    const out = await events('variant.double-done.sse');
    assert.equal(text(out), 'ok');
  });

  it('conteudo em partes vira texto', async () => {
    assert.equal(text(await events('variant.content-parts.sse')), 'Ola mundo');
  });
});
