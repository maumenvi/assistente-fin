import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado ao tentar lancar novamente o mes de um `Income` que ja tem uma `Transaction`
 * vinculada naquele mes (spec 012, RF-7) - a acao de lancar e idempotente, nao duplica.
 */
export class IncomeMonthAlreadyLaunchedError extends DomainError {
  public constructor() {
    super('INCOME_MONTH_ALREADY_LAUNCHED', 'mes ja foi lancado para este ganho');
  }
}
