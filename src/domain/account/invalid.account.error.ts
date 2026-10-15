import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de uma conta violam uma invariante do dominio. */
export class InvalidAccountError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_ACCOUNT', `conta invalida: ${reason}`);
  }
}
