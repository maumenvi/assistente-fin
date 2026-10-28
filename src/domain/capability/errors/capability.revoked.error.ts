import { AgentError } from '../../agent/errors/agent.error.ts';

/** capacidade revogada. */
export class CapabilityRevokedError extends AgentError {
  public constructor(detail?: string) {
    super('CAPABILITY_REVOKED', detail ? `capacidade revogada: ${detail}` : 'capacidade revogada');
  }
}
