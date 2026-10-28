import { AgentError } from '../../agent/errors/agent.error.ts';

/** Preferencia vaga demais para gravar ("seja melhor"): pede uma frase mais concreta. */
export class PreferenceTooVagueError extends AgentError {
  public constructor() {
    super('PREFERENCE_TOO_VAGUE', 'preferencia vaga demais para gravar');
  }
}
