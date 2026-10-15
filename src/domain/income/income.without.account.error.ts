import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado ao tentar lancar o mes de um `Income` sem `accountId` (spec 012, RF-4): um ganho
 * sem conta vinculada nunca aparece no Extrato/Dashboard, entao nao tem mes para lancar.
 */
export class IncomeWithoutAccountError extends DomainError {
  public constructor() {
    super('INCOME_WITHOUT_ACCOUNT', 'ganho sem conta vinculada nao pode ser lancado');
  }
}
