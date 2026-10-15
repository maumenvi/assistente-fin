import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de uma transacao violam uma invariante do dominio. */
export class InvalidTransactionError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_TRANSACTION', `transacao invalida: ${reason}`);
  }
}
