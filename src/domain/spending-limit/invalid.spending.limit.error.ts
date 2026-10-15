import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de um limite de gasto violam uma invariante do dominio. */
export class InvalidSpendingLimitError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_SPENDING_LIMIT', `limite de gasto invalido: ${reason}`);
  }
}
