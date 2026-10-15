import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando o plano de limite de gasto nao existe, ou nao pertence ao usuario (RF-16). */
export class SpendingLimitPlanNotFoundError extends DomainError {
  public constructor() {
    super('SPENDING_LIMIT_PLAN_NOT_FOUND', 'plano de limite de gasto nao encontrado');
  }
}
