import { AgentError } from './agent.error.ts';

/** Ja existe uma execucao ativa nesta conversa (FR-018). */
export class RunAlreadyActiveError extends AgentError {
  public constructor() {
    super('RUN_ALREADY_ACTIVE', 'ja existe uma execucao em andamento nesta conversa');
  }
}
