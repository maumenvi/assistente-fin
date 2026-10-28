import { AgentError } from './agent.error.ts';

/** Lançado quando o usuário pede para continuar uma execução que não está pausada por limite ou não tem checkpoint. */
export class RunNotContinuableError extends AgentError {
  constructor(message = 'Esta execução não pode ser continuada de onde parou.') {
    super('RUN_NOT_CONTINUABLE', message);
    this.name = 'RunNotContinuableError';
  }
}

