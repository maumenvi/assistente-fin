import { AgentError } from '../../agent/errors/agent.error.ts';

/** Preferencia inexistente (ou de outro usuario). */
export class PreferenceNotFoundError extends AgentError {
  public constructor() {
    super('PREFERENCE_NOT_FOUND', 'preferencia nao encontrada');
  }
}
