import { type LlmError } from '../../../domain/agent/errors/llm.error.ts';
import { errorBodySchema } from './error.schema.ts';
import { unwrapErrorBody } from './google.quirks.ts';
import { mapStatusToError } from './map.status.to.error.ts';
import { parseRetryAfter } from './parse.retry.after.ts';

/** Resposta HTTP de erro, ja lida. */
export interface HttpErrorInput {
  readonly status: number;
  readonly bodyText: string;
  readonly retryAfterHeader: string | null;
  readonly now: Date;
  readonly emittedContent: boolean;
}

/** Traduz uma resposta HTTP de erro no erro de dominio, lendo a mensagem do corpo quando houver. */
export function mapHttpError(input: HttpErrorInput): LlmError {
  let message: string | null = null;
  try {
    const parsed = errorBodySchema.safeParse(unwrapErrorBody(JSON.parse(input.bodyText)));
    if (parsed.success) message = parsed.data.error.message ?? null;
  } catch {
    message = null;
  }
  const retryAfter = parseRetryAfter(input.retryAfterHeader, input.now);
  return mapStatusToError(input.status, message, retryAfter, input.emittedContent);
}
