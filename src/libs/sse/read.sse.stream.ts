import { SseLimitError } from './sse.limit.error.ts';
import { type SseEvent } from './sse.event.ts';
import { SseParser } from './sse.parser.ts';
import { Utf8StreamDecoder } from './utf8.stream.decoder.ts';

/** Limite de uma linha parcial: 1 MiB. */
const MAX_LINE_CHARS = 1024 * 1024;
/** Limite dos `data` de um evento: 4 MiB. */
const MAX_EVENT_CHARS = 4 * 1024 * 1024;

/**
 * Le um corpo de resposta (fluxo de bytes) como eventos SSE (spec 031, D4). Libera o leitor ao
 * terminar, ao falhar e ao ser cancelado; o cancelamento por `signal` encerra a iteracao em silencio
 * (quem chamou decide, olhando `signal.aborted`). Linha > 1 MiB ou evento > 4 MiB lancam `SseLimitError`.
 */
export async function* readSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent, void, undefined> {
  const reader = body.getReader();
  const decoder = new Utf8StreamDecoder();
  const parser = new SseParser();
  const onAbort = (): void => {
    void reader.cancel().catch(() => undefined);
  };
  if (signal?.aborted) onAbort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    for (;;) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch (error) {
        if (signal?.aborted) return;
        throw error;
      }
      if (result.done) break;
      for (const event of parser.push(decoder.decode(result.value))) yield event;
      if (parser.partialLineLength > MAX_LINE_CHARS) throw new SseLimitError('line');
      if (parser.eventDataLength > MAX_EVENT_CHARS) throw new SseLimitError('event');
    }
    const tail = decoder.flush();
    if (tail !== '') for (const event of parser.push(tail)) yield event;
    parser.flush();
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
