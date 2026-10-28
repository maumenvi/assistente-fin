import { type SseEvent } from '../../../../src/libs/sse/sse.event.ts';

/** Monta um evento SSE com o objeto serializado em `data`. */
export function chunkEvent(chunk: unknown): SseEvent {
  return { event: 'message', data: JSON.stringify(chunk), id: null, retry: null };
}

/** O sentinela `[DONE]`. */
export const DONE_EVENT: SseEvent = { event: 'message', data: '[DONE]', id: null, retry: null };

/** Transforma uma lista em `AsyncIterable`. */
export async function* asAsync<T>(items: readonly T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

/** Delta de texto no formato chat completions. */
export function textChunk(content: string, finishReason: string | null = null): unknown {
  return { choices: [{ delta: { content }, finish_reason: finishReason }] };
}
