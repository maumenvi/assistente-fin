import { AgentError } from './agent.error.ts';

/** Nao ha modelo principal configurado para o agente responder. */
export class NoModelConfiguredError extends AgentError {
  public constructor() {
    super('NO_MODEL_CONFIGURED', 'nenhum modelo configurado');
  }
}
