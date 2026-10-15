import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de um plano de limite de gasto violam uma invariante do dominio. */
export class InvalidSpendingLimitPlanError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_SPENDING_LIMIT_PLAN', `plano de limite de gasto invalido: ${reason}`);
  }
}
