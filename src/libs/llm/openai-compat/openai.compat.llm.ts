import { LlmProtocolError } from '../../../domain/agent/errors/llm.protocol.error.ts';
import { LlmUnavailableError } from '../../../domain/agent/errors/llm.unavailable.error.ts';
import { RunCancelledError } from '../../../domain/agent/errors/run.cancelled.error.ts';
import { AgentError } from '../../../domain/agent/errors/agent.error.ts';
import { type ModelCapabilities } from '../../../domain/agent/model.capabilities.ts';
import { type LlmEvent } from '../../../app/agent/ports/llm/llm.event.ts';
import { type LlmPort } from '../../../app/agent/ports/llm/llm.port.ts';
import { type LlmRequest } from '../../../app/agent/ports/llm/llm.request.ts';
import { readSseStream } from '../../sse/read.sse.stream.ts';
import { SseLimitError } from '../../sse/sse.limit.error.ts';
import { type SseEvent } from '../../sse/sse.event.ts';
import { DEFAULT_LLM_TIMEOUTS } from '../default.llm.timeouts.ts';
import { DEFAULT_RETRY_OPTIONS } from '../default.retry.options.ts';
import { isLocalBaseUrl } from '../is.local.base.url.ts';
import { withRetry } from '../with.retry.ts';
import { sleep } from '../sleep.ts';
import { buildRequestBody } from './build.request.ts';
import { mapHttpError } from './map.http.error.ts';
import { mapNetworkError } from './map.network.error.ts';
import { mapStream } from './map.stream.ts';
import { type OpenAiCompatOptions } from './openai.compat.options.ts';

/** Quanto do corpo de uma resposta de erro e lido (basta para a mensagem do provedor). */
const MAX_ERROR_BODY_CHARS = 4096;

/**
 * Adaptador de `LlmPort` para qualquer servidor OpenAI-compativel (spec 031, D3/D5): OpenRouter
 * (Sonnet e outros grandes) e servidores locais mudando so `baseUrl`/chave. Monta o pedido, le o
 * stream SSE, aplica os tres tempos limite (conexao, primeiro conteudo e silencio) e as
 * retentativas ANTES de qualquer conteudo. Nunca registra cabecalhos nem o corpo.
 */
export class OpenAiCompatLlm implements LlmPort {
  public readonly capabilities: ModelCapabilities;
  private readonly options: OpenAiCompatOptions;

  public constructor(options: OpenAiCompatOptions) {
    this.options = options;
    this.capabilities = options.capabilities;
  }

  public stream(request: LlmRequest, signal?: AbortSignal): AsyncIterable<LlmEvent> {
    return withRetry(
      () => this.attempt(request, signal),
      signal,
      this.options.retry ?? DEFAULT_RETRY_OPTIONS,
      this.options.retryDeps ?? { sleep, random: Math.random },
    );
  }

  private async *attempt(request: LlmRequest, outer: AbortSignal | undefined): AsyncGenerator<LlmEvent, void, undefined> {
    const timeouts = this.options.timeouts ?? DEFAULT_LLM_TIMEOUTS;
    const controller = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let emitted = false;
    const arm = (ms: number): void => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, ms);
    };
    const onOuterAbort = (): void => controller.abort();
    if (outer?.aborted) throw new RunCancelledError();
    outer?.addEventListener('abort', onOuterAbort, { once: true });
    try {
      const response = await this.send(request, controller, arm, timeouts.connectMs, outer, () => timedOut);
      arm(timeouts.firstContentMs);
      const body = response.body;
      if (body === null) throw new LlmProtocolError('resposta sem corpo', false);
      const events = this.withWatchdog(readSseStream(body, controller.signal), arm, timeouts.idleMs, () => timedOut || outer?.aborted === true);
      for await (const event of mapStream(events)) {
        if (event.type === 'text_delta' || event.type === 'tool_call') emitted = true;
        yield event;
      }
      if (outer?.aborted) throw new RunCancelledError();
    } catch (error) {
      throw this.translate(error, outer, timedOut, emitted);
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
      controller.abort();
    }
  }

  private async send(
    request: LlmRequest,
    controller: AbortController,
    arm: (ms: number) => void,
    connectMs: number,
    outer: AbortSignal | undefined,
    wasTimedOut: () => boolean,
  ): Promise<Response> {
    const { baseUrl, model, apiKey, fetchFn, extraHeaders } = this.options;
    const body = buildRequestBody({
      model,
      request,
      capabilities: this.capabilities,
      includeUsage: this.options.includeUsage ?? !isLocalBaseUrl(baseUrl),
      ...(this.options.origin !== undefined ? { origin: this.options.origin } : {}),
    });
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'text/event-stream',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      ...extraHeaders,
    };
    arm(connectMs);
    let response: Response;
    try {
      response = await fetchFn(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (outer?.aborted) throw new RunCancelledError();
      if (wasTimedOut()) throw new LlmUnavailableError('tempo esgotado para conectar ao modelo', false);
      throw mapNetworkError(error, false);
    }
    if (!response.ok) {
      const text = await response.text().then((t) => t.slice(0, MAX_ERROR_BODY_CHARS), () => '');
      throw mapHttpError({
        status: response.status,
        bodyText: text,
        retryAfterHeader: response.headers.get('retry-after'),
        now: (this.options.now ?? (() => new Date()))(),
        emittedContent: false,
      });
    }
    return response;
  }

  private async *withWatchdog(
    source: AsyncIterable<SseEvent>,
    arm: (ms: number) => void,
    idleMs: number,
    wasInterrupted: () => boolean,
  ): AsyncGenerator<SseEvent, void, undefined> {
    for await (const event of source) {
      arm(idleMs);
      yield event;
    }
    // O leitor encerra em silencio ao abortar; sem isto o fim tolerante (FR-016) aceitaria um corte por tempo/cancelamento.
    if (wasInterrupted()) throw new LlmProtocolError('o stream foi interrompido', true, 'fim_inesperado');
  }

  private translate(error: unknown, outer: AbortSignal | undefined, timedOut: boolean, emitted: boolean): Error {
    if (outer?.aborted) return new RunCancelledError();
    if (timedOut) return new LlmUnavailableError('o modelo parou de responder (tempo esgotado)', emitted);
    if (error instanceof AgentError) return error;
    if (error instanceof SseLimitError) return new LlmProtocolError(error.message, emitted);
    return mapNetworkError(error, emitted);
  }
}
