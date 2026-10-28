import { AgentError } from './agent.error.ts';

/** Limite da execucao atingido (FR-017); `which` diz qual: passos, tempo ou custo. */
export class BudgetExceededError extends AgentError {
  public readonly which: 'steps' | 'time' | 'cost';

  public constructor(which: 'steps' | 'time' | 'cost') {
    super('BUDGET_EXCEEDED', `limite de ${which} da execucao atingido`);
    this.which = which;
  }
}
