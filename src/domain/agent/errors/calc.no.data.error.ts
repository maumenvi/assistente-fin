import { AgentError } from './agent.error.ts';

/** Calculo pedido sem valores ou sobre periodo sem lancamentos (spec 037). */
export class CalcNoDataError extends AgentError {
  public constructor(message = 'sem dados para calcular') {
    super('CALC_NO_DATA', message, false);
  }
}

