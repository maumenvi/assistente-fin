import { AgentError } from '../../agent/errors/agent.error.ts';

/** capacidade nao suportada neste aparelho. */
export class CapabilityPlatformUnsupportedError extends AgentError {
  public constructor(detail?: string) {
    super('CAPABILITY_PLATFORM_UNSUPPORTED', detail ? `capacidade nao suportada neste aparelho: ${detail}` : 'capacidade nao suportada neste aparelho');
  }
}
