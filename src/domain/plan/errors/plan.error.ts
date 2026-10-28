import { AgentError } from '../../agent/errors/agent.error.ts';

/** Base dos erros de plano (spec 033); `code` estavel para a borda traduzir. */
export class PlanError extends AgentError {
  public constructor(code: string, message: string) {
    super(code, message);
  }
}
