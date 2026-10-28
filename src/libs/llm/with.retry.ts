import { AgentError } from '../../domain/agent/errors/agent.error.ts';
import { LlmRateLimitedError } from '../../domain/agent/errors/llm.rate.limited.error.ts';
import { RunCancelledError } from '../../domain/agent/errors/run.cancelled.error.ts';
import { type LlmEvent } from '../../app/agent/ports/llm/llm.event.ts';
import { DEFAULT_RETRY_OPTIONS } from './default.retry.options.ts';
import { type RetryDeps } from './retry.deps.ts';
import { type RetryOptions } from './retry.options.ts';
import { sleep } from './sleep.ts';

const DEFAULT_DEPS: RetryDeps = { sleep, random: Math.random };

/** Atraso da proxima tentativa: `Retry-After` (com teto) ou o atraso base com jitter. */
function nextDelay(error: AgentError, attempt: number, options: RetryOptions, random: () => number): number {
  if (error instanceof LlmRateLimitedError && error.retryAfterMs !== null) {
    return Math.min(error.retryAfterMs, options.maxRetryAfterMs);
  }
  const base = options.delaysMs[Math.min(attempt, options.delaysMs.length - 1)] ?? 0;
  const spread = (random() * 2 - 1) * options.jitter;
  return Math.max(0, Math.round(base * (1 + spread)));
}

/**
 * Reabre o stream quando a tentativa falha com erro retentavel ANTES de qualquer evento ter sido
 * entregue ao consumidor (spec 031, D5): depois do primeiro evento nenhuma retentativa e feita,
 * para nunca duplicar texto ja exibido. Erros nao retentaveis, ou que estouram as tentativas,
 * sobem intactos. O cancelamento durante o atraso lanca `RunCancelledError`.
 */
export async function* withRetry(
  start: () => AsyncIterable<LlmEvent>,
  signal?: AbortSignal,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
  deps: RetryDeps = DEFAULT_DEPS,
): AsyncGenerator<LlmEvent, void, undefined> {
  for (let attempt = 0; ; attempt += 1) {
    if (signal?.aborted) throw new RunCancelledError();
    let delivered = false;
    try {
      for await (const event of start()) {
        delivered = true;
        yield event;
      }
      return;
    } catch (error) {
      const canRetry =
        !delivered && attempt < options.maxRetries && error instanceof AgentError && error.retriable;
      if (!canRetry) throw error;
      await deps.sleep(nextDelay(error, attempt, options, deps.random), signal);
    }
  }
}
