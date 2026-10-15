import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de um cenario de projecao (ou um ajuste dele) violam uma invariante. */
export class InvalidScenarioError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_SCENARIO', `cenario invalido: ${reason}`);
  }
}
