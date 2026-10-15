import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando o limite nao existe, ou existe mas nao pertence ao usuario (RF-16, CA-14). */
export class SpendingLimitNotFoundError extends DomainError {
  public constructor() {
    super('SPENDING_LIMIT_NOT_FOUND', 'limite de gasto nao encontrado');
  }
}
