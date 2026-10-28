import { AgentError } from '../../agent/errors/agent.error.ts';

/** capacidade nao aprovada. */
export class CapabilityNotApprovedError extends AgentError {
  public constructor(detail?: string) {
    super('CAPABILITY_NOT_APPROVED', detail ? `capacidade nao aprovada: ${detail}` : 'capacidade nao aprovada');
  }
}
