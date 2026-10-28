import { AgentError } from '../../agent/errors/agent.error.ts';

/** transicao de estado invalida. */
export class CapabilityInvalidTransitionError extends AgentError {
  public constructor(detail?: string) {
    super('CAPABILITY_INVALID_TRANSITION', detail ? `transicao de estado invalida: ${detail}` : 'transicao de estado invalida');
  }
}
