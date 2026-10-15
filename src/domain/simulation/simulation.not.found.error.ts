import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando a simulacao nao existe, ou existe mas nao pertence ao usuario (RF-16, CA-14). */
export class SimulationNotFoundError extends DomainError {
  public constructor() {
    super('SIMULATION_NOT_FOUND', 'simulacao nao encontrada');
  }
}
