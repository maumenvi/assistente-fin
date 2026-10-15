import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando o gasto fixo nao existe, ou existe mas nao pertence ao usuario (RF-16, CA-14). */
export class FixedExpenseNotFoundError extends DomainError {
  public constructor() {
    super('FIXED_EXPENSE_NOT_FOUND', 'gasto fixo nao encontrado');
  }
}
