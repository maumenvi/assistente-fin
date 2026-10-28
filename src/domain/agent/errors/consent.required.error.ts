import { AgentError } from './agent.error.ts';

/** Envio a modelo na nuvem sem consentimento registrado (FR-027): nada foi enviado. */
export class ConsentRequiredError extends AgentError {
  public constructor() {
    super('CONSENT_REQUIRED', 'consentimento de envio a nuvem nao registrado');
  }
}
