import { LlmError } from './llm.error.ts';

/** Chave de API invalida ou sem permissao (HTTP 401/403). */
export class LlmAuthError extends LlmError {
  public constructor(emittedContent = false) {
    super('LLM_AUTH', 'chave de API invalida ou sem permissao', false, emittedContent);
  }
}
