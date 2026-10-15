import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando o ganho nao existe, ou existe mas nao pertence ao usuario (RF-16, CA-14). */
export class IncomeNotFoundError extends DomainError {
  public constructor() {
    super('INCOME_NOT_FOUND', 'ganho nao encontrado');
  }
}
