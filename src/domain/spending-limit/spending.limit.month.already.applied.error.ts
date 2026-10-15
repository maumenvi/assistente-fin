import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado ao tentar aplicar de novo o mes de um `SpendingLimitPlan` que ja tem um
 * `SpendingLimit` vinculado naquele mes (spec 016) - a acao de aplicar e idempotente, nao
 * duplica.
 */
export class SpendingLimitMonthAlreadyAppliedError extends DomainError {
  public constructor() {
    super('SPENDING_LIMIT_MONTH_ALREADY_APPLIED', 'mes ja foi aplicado para este plano de limite');
  }
}
