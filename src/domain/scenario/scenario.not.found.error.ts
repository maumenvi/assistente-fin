import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando o cenario nao existe, ou existe mas nao pertence ao usuario (RF-16, RF-36). */
export class ScenarioNotFoundError extends DomainError {
  public constructor() {
    super('SCENARIO_NOT_FOUND', 'cenario nao encontrado');
  }
}
