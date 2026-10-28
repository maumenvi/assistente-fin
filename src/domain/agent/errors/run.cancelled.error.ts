import { AgentError } from './agent.error.ts';

/** A execucao foi cancelada (botao Parar, logout ou troca de usuario). */
export class RunCancelledError extends AgentError {
  public constructor() {
    super('RUN_CANCELLED', 'execucao cancelada');
  }
}
