import { AgentError } from './agent.error.ts';

/** Expressao aritmetica invalida (sintaxe, identificador proibido ou operador desconhecido — spec 037). */
export class CalcInvalidExpressionError extends AgentError {
  public constructor(message = 'expressao aritmetica invalida') {
    super('CALC_INVALID_EXPRESSION', message, false);
  }
}

