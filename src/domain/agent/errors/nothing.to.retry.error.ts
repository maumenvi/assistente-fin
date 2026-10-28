import { AgentError } from './agent.error.ts';

/** A mensagem pedida nao pode ser refeita (nao e a ultima resposta, ou ela terminou bem). */
export class NothingToRetryError extends AgentError {
  public constructor() {
    super('NOTHING_TO_RETRY', 'nao ha resposta interrompida para tentar de novo');
  }
}
