import { AgentError } from '../../agent/errors/agent.error.ts';

/** capacidade insegura. */
export class CapabilityUnsafeError extends AgentError {
  public constructor(detail?: string) {
    super('CAPABILITY_UNSAFE', detail ? `capacidade insegura: ${detail}` : 'capacidade insegura');
  }
}
