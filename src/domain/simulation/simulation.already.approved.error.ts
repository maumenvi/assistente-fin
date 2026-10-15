import { DomainError } from '../shared/domain.error.ts';

/** Lancado ao tentar aprovar de novo uma `PurchaseSimulation` ja aprovada (spec 001, RF-11). */
export class SimulationAlreadyApprovedError extends DomainError {
  public constructor() {
    super('SIMULATION_ALREADY_APPROVED', 'simulacao ja aprovada');
  }
}
