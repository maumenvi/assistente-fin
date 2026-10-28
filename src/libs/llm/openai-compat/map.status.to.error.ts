import { type LlmError } from '../../../domain/agent/errors/llm.error.ts';
import { LlmAuthError } from '../../../domain/agent/errors/llm.auth.error.ts';
import { LlmKeyExpiredError } from '../../../domain/agent/errors/llm.key.expired.error.ts';
import { LlmModelNotFoundError } from '../../../domain/agent/errors/llm.model.not.found.error.ts';
import { LlmProtocolError } from '../../../domain/agent/errors/llm.protocol.error.ts';
import { LlmQuotaError } from '../../../domain/agent/errors/llm.quota.error.ts';
import { LlmRateLimitedError } from '../../../domain/agent/errors/llm.rate.limited.error.ts';
import { LlmUnavailableError } from '../../../domain/agent/errors/llm.unavailable.error.ts';
import { isGoogleInvalidKeyMessage, isQuotaMessage } from './google.quirks.ts';
import { sanitizeProviderMessage } from './sanitize.provider.message.ts';

/**
 * Traduz um codigo HTTP (ou o codigo numerico de um erro dentro do stream) no erro de dominio
 * (tabela de `contracts/llm.port.md`). 401/403 auth (e 400 "API key not valid" do Google); 402 cota (e 429 com texto de cota); 404 modelo; 408/409/425/429
 * limite de taxa (retentavel); 5xx indisponivel (retentavel); demais 4xx formato/pedido invalido.
 */
export function mapStatusToError(
  status: number,
  providerMessage: string | null,
  retryAfterMs: number | null,
  emittedContent: boolean,
): LlmError {
  if ((status === 401 || status === 403) && providerMessage !== null && /expired|expirad|venc/i.test(providerMessage)) return new LlmKeyExpiredError(emittedContent);
  if (status === 401 || status === 403) return new LlmAuthError(emittedContent);
  if (status === 400 && isGoogleInvalidKeyMessage(providerMessage)) return new LlmAuthError(emittedContent);
  if (status === 402 || (status === 429 && isQuotaMessage(providerMessage))) return new LlmQuotaError(emittedContent);
  if (status === 404) return new LlmModelNotFoundError(emittedContent);
  if (status === 408 || status === 409 || status === 425 || status === 429) {
    return new LlmRateLimitedError(retryAfterMs, emittedContent);
  }
  if (status >= 500) {
    const detail = providerMessage === null ? '' : `: ${sanitizeProviderMessage(providerMessage)}`;
    return new LlmUnavailableError(`provedor indisponivel (HTTP ${status})${detail}`, emittedContent);
  }
  const detail = providerMessage === null ? '' : `: ${sanitizeProviderMessage(providerMessage)}`;
  return new LlmProtocolError(`pedido recusado pelo provedor (HTTP ${status})${detail}`, emittedContent);
}
