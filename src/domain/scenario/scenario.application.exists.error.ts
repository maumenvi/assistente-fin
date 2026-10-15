import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado ao aplicar um cenario quando o usuario ja tem uma aplicacao ativa (RF-40) - e
 * preciso desfazer a anterior antes de aplicar outra.
 */
export class ScenarioApplicationExistsError extends DomainError {
  public constructor() {
    super(
      'SCENARIO_APPLICATION_EXISTS',
      'ja existe uma aplicacao de cenario ativa - desfaca-a antes de aplicar outra',
    );
  }
}
