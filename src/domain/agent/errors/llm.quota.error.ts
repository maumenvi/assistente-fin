import { LlmError } from './llm.error.ts';

/** Creditos esgotados ou cota excedida (HTTP 402). */
export class LlmQuotaError extends LlmError {
  public constructor(emittedContent = false) {
    super('LLM_QUOTA', 'creditos ou cota do provedor esgotados', false, emittedContent);
  }
}
