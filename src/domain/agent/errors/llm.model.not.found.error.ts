import { LlmError } from './llm.error.ts';

/** O modelo configurado nao existe no provedor (HTTP 404). */
export class LlmModelNotFoundError extends LlmError {
  public constructor(emittedContent = false) {
    super('LLM_MODEL_NOT_FOUND', 'modelo nao encontrado no provedor', false, emittedContent);
  }
}
