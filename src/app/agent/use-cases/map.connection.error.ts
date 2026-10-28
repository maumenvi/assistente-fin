import { LlmAuthError } from '../../../domain/agent/errors/llm.auth.error.ts';
import { LlmKeyExpiredError } from '../../../domain/agent/errors/llm.key.expired.error.ts';
import { LlmModelNotFoundError } from '../../../domain/agent/errors/llm.model.not.found.error.ts';
import { LlmQuotaError } from '../../../domain/agent/errors/llm.quota.error.ts';
import { LlmRateLimitedError } from '../../../domain/agent/errors/llm.rate.limited.error.ts';
import { type ModelOrigin } from '../../../domain/agent/model.origin.ts';
import { type ConnectionTestError } from './connection.test.result.ts';

/** Erro da camada de LLM -> codigo mostrado na tela de configuracao. */
export function mapConnectionError(error: unknown, origin: ModelOrigin): ConnectionTestError {
  if (error instanceof LlmAuthError || error instanceof LlmKeyExpiredError) return 'invalid_key';
  if (error instanceof LlmModelNotFoundError) return 'model_unavailable';
  if (error instanceof LlmQuotaError || error instanceof LlmRateLimitedError) return 'quota';
  return origin === 'openai_compat_local' ? 'local_unreachable' : 'offline';
}
