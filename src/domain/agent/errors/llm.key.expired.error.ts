import { LlmError } from './llm.error.ts';

/** A chave existe, mas passou da validade (OpenRouter: `expires_at` vencido). */
export class LlmKeyExpiredError extends LlmError {
  public constructor(emittedContent = false) {
    super('LLM_KEY_EXPIRED', 'chave de API vencida', false, emittedContent);
  }
}
