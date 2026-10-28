import { LlmAuthError } from '../../../../domain/agent/errors/llm.auth.error.ts';
import { LlmKeyExpiredError } from '../../../../domain/agent/errors/llm.key.expired.error.ts';
import { LlmQuotaError } from '../../../../domain/agent/errors/llm.quota.error.ts';
import { type ConnectionStep } from '../../../../domain/agent/connection/connection.step.ts';
import { reachFailureStep } from './reach.failure.step.ts';

/** Erro de uma chamada que ja alcancou o servidor: chave recusada/vencida/sem credito; qualquer outro = nao alcancou. */
export function keyStepOfLlmError(error: unknown, local: boolean): ConnectionStep {
  if (error instanceof LlmKeyExpiredError) return { id: 'key', status: 'failed', code: 'key.expired' };
  if (error instanceof LlmAuthError) return { id: 'key', status: 'failed', code: 'key.invalid' };
  if (error instanceof LlmQuotaError) return { id: 'key', status: 'failed', code: 'key.no_credit' };
  return reachFailureStep(error, local);
}
