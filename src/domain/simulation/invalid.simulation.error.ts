import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de uma simulacao de compra violam uma invariante do dominio. */
export class InvalidSimulationError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_SIMULATION', `simulacao invalida: ${reason}`);
  }
}
