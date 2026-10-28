import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSseStream } from '../../../src/libs/sse/read.sse.stream.ts';
import { SseLimitError } from '../../../src/libs/sse/sse.limit.error.ts';

const encoder = new TextEncoder();

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = chunks[index];
      index += 1;
      if (next === undefined) controller.close();
      else controller.enqueue(next);
    },
  });
}

async function collect(iterable: AsyncIterable<{ data: string }>): Promise<string[]> {
  const out: string[] = [];
  for await (const event of iterable) out.push(event.data);
  return out;
}

describe('readSseStream', () => {
  it('le eventos de um corpo em varios chunks, com acento partido', async () => {
    const bytes = encoder.encode('data: ação\n\ndata: fim\n\n');
    const chunks = [bytes.subarray(0, 8), bytes.subarray(8, 9), bytes.subarray(9)];
    assert.deepEqual(await collect(readSseStream(streamOf(chunks))), ['ação', 'fim']);
  });

  it('corpo vazio nao gera evento', async () => {
    assert.deepEqual(await collect(readSseStream(streamOf([]))), []);
  });

  it('libera o leitor ao terminar (o corpo pode ser reutilizado)', async () => {
    const body = streamOf([encoder.encode('data: a\n\n')]);
    await collect(readSseStream(body));
    assert.equal(body.locked, false);
  });

  it('cancelamento no meio encerra a iteracao e libera o leitor', async () => {
    const controller = new AbortController();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode('data: um\n\n'));
      },
      cancel() {
        cancelled = true;
      },
    });
    const seen: string[] = [];
    for await (const event of readSseStream(body, controller.signal)) {
      seen.push(event.data);
      controller.abort();
    }
    assert.deepEqual(seen, ['um']);
    assert.equal(cancelled, true);
    assert.equal(body.locked, false);
  });

  it('abortado antes de comecar nao entrega nada', async () => {
    const controller = new AbortController();
    controller.abort();
    const body = streamOf([encoder.encode('data: a\n\n')]);
    assert.deepEqual(await collect(readSseStream(body, controller.signal)), []);
    assert.equal(body.locked, false);
  });

  it('linha acima de 1 MiB lanca SseLimitError', async () => {
    const big = encoder.encode(`data: ${'a'.repeat(1024 * 1024 + 10)}`);
    await assert.rejects(collect(readSseStream(streamOf([big]))), (error: unknown) => {
      assert.ok(error instanceof SseLimitError);
      assert.equal(error.limit, 'line');
      return true;
    });
  });

  it('evento acima de 4 MiB lanca SseLimitError', async () => {
    const line = encoder.encode(`data: ${'b'.repeat(500_000)}\n`);
    const chunks = Array.from({ length: 10 }, () => line);
    await assert.rejects(collect(readSseStream(streamOf(chunks))), (error: unknown) => {
      assert.ok(error instanceof SseLimitError);
      assert.equal(error.limit, 'event');
      return true;
    });
  });

  it('erro de leitura que nao e cancelamento sobe e libera o leitor', async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('rede caiu'));
      },
    });
    await assert.rejects(collect(readSseStream(body)), /rede caiu/);
    assert.equal(body.locked, false);
  });
});
