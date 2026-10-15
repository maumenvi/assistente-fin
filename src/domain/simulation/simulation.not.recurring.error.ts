import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado ao aprovar como `'planned'` uma simulacao que nao e recorrente (RF-11, plan.md
 * decisao 13) - `FixedExpense` nao modela "recorrencia com fim", entao virar gasto planejado
 * so faz sentido pra compra recorrente; a vista/parcelada viram `Transaction` (`as: 'real'`).
 */
export class SimulationNotRecurringError extends DomainError {
  public constructor() {
    super('SIMULATION_NOT_RECURRING', 'simulacao nao e recorrente: nao pode virar gasto planejado');
  }
}
