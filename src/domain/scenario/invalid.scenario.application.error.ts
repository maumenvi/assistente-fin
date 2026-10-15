import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de uma aplicacao de cenario ("recibo") violam uma invariante. */
export class InvalidScenarioApplicationError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_SCENARIO_APPLICATION', `aplicacao de cenario invalida: ${reason}`);
  }
}
