import { DomainError } from '../shared/domain.error.ts';

/** Lancado ao desfazer/consultar uma aplicacao de cenario que nao existe no escopo do usuario. */
export class ScenarioApplicationNotFoundError extends DomainError {
  public constructor() {
    super('SCENARIO_APPLICATION_NOT_FOUND', 'aplicacao de cenario nao encontrada');
  }
}
