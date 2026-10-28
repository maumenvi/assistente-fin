import { AgentError } from '../../agent/errors/agent.error.ts';

/** capacidade nao encontrada. */
export class CapabilityNotFoundError extends AgentError {
  public constructor(detail?: string) {
    super('CAPABILITY_NOT_FOUND', detail ? `capacidade nao encontrada: ${detail}` : 'capacidade nao encontrada');
  }
}
