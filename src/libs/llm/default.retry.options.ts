import { type RetryOptions } from './retry.options.ts';

/** Ate 2 retentativas, 400 ms e 1,2 s com +-20% de jitter, `Retry-After` limitado a 5 s. */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = Object.freeze({
  maxRetries: 2,
  delaysMs: [400, 1200],
  jitter: 0.2,
  maxRetryAfterMs: 5000,
});
