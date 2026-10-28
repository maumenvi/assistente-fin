import { AgentError } from '../../agent/errors/agent.error.ts';

/** a capacidade mudou depois da aprovacao. */
export class CapabilityIdentityChangedError extends AgentError {
  public constructor(detail?: string) {
    super('CAPABILITY_IDENTITY_CHANGED', detail ? `a capacidade mudou depois da aprovacao: ${detail}` : 'a capacidade mudou depois da aprovacao');
  }
}
