import { AgentError } from '../../agent/errors/agent.error.ts';

/** Resumo de conversa que nao passou na validacao (FR-016): o contexto cai no descarte seguro. */
export class SummaryInvalidError extends AgentError {
  public constructor(reason: string) {
    super('SUMMARY_INVALID', `resumo invalido: ${reason}`);
  }
}
