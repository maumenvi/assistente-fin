import { AgentError } from '../../agent/errors/agent.error.ts';

/** Dado pessoal sensivel (saude, documentos...) nunca vira preferencia (FR-008). */
export class PreferenceSensitiveError extends AgentError {
  public constructor() {
    super('PREFERENCE_SENSITIVE', 'dado sensivel nao e guardado como preferencia');
  }
}
