import { AgentError } from './agent.error.ts';

/** O caminho pedido tenta sair da pasta autorizada (`..`, caminho relativo) (spec 040, FR-011). */
export class PathOutsideGrantError extends AgentError {
  public constructor() {
    super('PATH_OUTSIDE_GRANT', 'o caminho esta fora da pasta autorizada');
  }
}
