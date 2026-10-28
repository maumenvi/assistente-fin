import { type LlmPort } from '../ports/llm/llm.port.ts';

/** Modelo escolhido e o papel que de fato vai responder (para o trace registrar). */
export interface PickedLlm {
  readonly llm: LlmPort;
  readonly answeredBy: 'main' | 'fast';
}
