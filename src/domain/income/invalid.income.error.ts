import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de um ganho violam uma invariante do dominio. */
export class InvalidIncomeError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_INCOME', `ganho invalido: ${reason}`);
  }
}
