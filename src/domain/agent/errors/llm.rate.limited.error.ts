import { LlmError } from './llm.error.ts';

/** Limite de taxa do provedor (HTTP 408/409/425/429). `retryAfterMs` vem do cabecalho `Retry-After`. */
export class LlmRateLimitedError extends LlmError {
  public readonly retryAfterMs: number | null;

  public constructor(retryAfterMs: number | null = null, emittedContent = false) {
    super('LLM_RATE_LIMITED', 'limite de requisicoes do provedor', true, emittedContent);
    this.retryAfterMs = retryAfterMs;
  }
}
