import { AgentError } from './agent.error.ts';

/** Divisao por zero em um calculo ou variacao percentual com base zero (spec 037). */
export class CalcDivisionByZeroError extends AgentError {
  public constructor(message = 'divisao por zero') {
    super('CALC_DIVISION_BY_ZERO', message, false);
  }
}

