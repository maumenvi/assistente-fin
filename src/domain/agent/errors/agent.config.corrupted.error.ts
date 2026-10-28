import { AgentError } from './agent.error.ts';

/** A configuracao cifrada do agente esta corrompida ou foi adulterada. */
export class AgentConfigCorruptedError extends AgentError {
  public constructor(reason: string) {
    super('AGENT_CONFIG_CORRUPTED', `configuracao do agente corrompida: ${reason}`);
  }
}
