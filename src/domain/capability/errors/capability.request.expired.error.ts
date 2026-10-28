import { AgentError } from '../../agent/errors/agent.error.ts';

/** pedido de capacidade vencido. */
export class CapabilityRequestExpiredError extends AgentError {
  public constructor(detail?: string) {
    super('CAPABILITY_REQUEST_EXPIRED', detail ? `pedido de capacidade vencido: ${detail}` : 'pedido de capacidade vencido');
  }
}
