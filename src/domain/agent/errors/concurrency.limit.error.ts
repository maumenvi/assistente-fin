import { AgentError } from './agent.error.ts';

/** Ja ha o maximo de conversas executando ao mesmo tempo (spec 040, FR-008). */
export class ConcurrencyLimitError extends AgentError {
  public constructor(limit: number) {
    super('CONCURRENCY_LIMIT', `ja ha ${limit} conversas executando ao mesmo tempo`);
  }
}
