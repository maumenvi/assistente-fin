import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de um gasto fixo violam uma invariante do dominio. */
export class InvalidFixedExpenseError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_FIXED_EXPENSE', `gasto fixo invalido: ${reason}`);
  }
}
