import { type AgentError } from '../../../domain/agent/errors/agent.error.ts';
import { LlmAuthError } from '../../../domain/agent/errors/llm.auth.error.ts';
import { LlmKeyExpiredError } from '../../../domain/agent/errors/llm.key.expired.error.ts';
import { LlmModelNotFoundError } from '../../../domain/agent/errors/llm.model.not.found.error.ts';
import { LlmProtocolError } from '../../../domain/agent/errors/llm.protocol.error.ts';
import { LlmQuotaError } from '../../../domain/agent/errors/llm.quota.error.ts';
import { LlmRateLimitedError } from '../../../domain/agent/errors/llm.rate.limited.error.ts';
import { LlmUnavailableError } from '../../../domain/agent/errors/llm.unavailable.error.ts';
import { sanitizeProviderMessage } from '../openai-compat/sanitize.provider.message.ts';
import { type ReplayError } from './replay.error.ts';

/** Cria o erro de dominio descrito por uma falha gravada. */
export function buildReplayError(error: ReplayError, defaultEmitted: boolean): AgentError {
  const emitted = error.emittedContent ?? defaultEmitted;
  const message = error.message === undefined ? undefined : sanitizeProviderMessage(error.message);
  switch (error.code) {
    case 'LLM_AUTH':
      return new LlmAuthError(emitted);
    case 'LLM_KEY_EXPIRED':
      return new LlmKeyExpiredError(emitted);
    case 'LLM_QUOTA':
      return new LlmQuotaError(emitted);
    case 'LLM_MODEL_NOT_FOUND':
      return new LlmModelNotFoundError(emitted);
    case 'LLM_RATE_LIMITED':
      return new LlmRateLimitedError(error.retryAfterMs ?? null, emitted);
    case 'LLM_PROTOCOL':
      return new LlmProtocolError(message, emitted);
    case 'LLM_PROTOCOL_CHUNK':
      return new LlmProtocolError(message, emitted, 'chunk_invalido');
    case 'LLM_PROTOCOL_END':
      return new LlmProtocolError(message, emitted, 'fim_inesperado');
    case 'LLM_PROTOCOL_EMPTY':
      return new LlmProtocolError(message, emitted, 'sem_saida');
    default:
      return new LlmUnavailableError(message, emitted);
  }
}
