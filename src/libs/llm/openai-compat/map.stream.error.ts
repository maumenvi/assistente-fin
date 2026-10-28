import { type LlmError } from '../../../domain/agent/errors/llm.error.ts';
import { LlmUnavailableError } from '../../../domain/agent/errors/llm.unavailable.error.ts';
import { mapStatusToError } from './map.status.to.error.ts';
import { sanitizeProviderMessage } from './sanitize.provider.message.ts';
import { type ProviderError } from './provider.error.schema.ts';

/**
 * Traduz um erro que veio DENTRO do stream (`data: {"error": ...}`). O codigo numerico segue a
 * tabela HTTP; sem codigo numerico, e indisponibilidade do provedor.
 */
export function mapStreamError(error: ProviderError, emittedContent: boolean): LlmError {
  const code = typeof error.code === 'number' ? error.code : Number.parseInt(String(error.code ?? ''), 10);
  const message = error.message ?? null;
  if (Number.isInteger(code) && code >= 400) return mapStatusToError(code, message, null, emittedContent);
  const detail = message === null ? 'erro do provedor' : sanitizeProviderMessage(message);
  return new LlmUnavailableError(detail, emittedContent);
}
