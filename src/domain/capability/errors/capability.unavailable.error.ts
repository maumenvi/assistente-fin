import { AgentError } from '../../agent/errors/agent.error.ts';

/** capacidade indisponivel. */
export class CapabilityUnavailableError extends AgentError {
  public constructor(detail?: string) {
    super('CAPABILITY_UNAVAILABLE', detail ? `capacidade indisponivel: ${detail}` : 'capacidade indisponivel');
  }
}
