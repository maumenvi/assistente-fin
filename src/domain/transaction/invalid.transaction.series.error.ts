import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando os dados de uma serie de transacoes violam uma invariante do dominio
 * (spec 003, RF-25). Serie so existe para lancamentos recorrentes: uma serie `nao-repete`
 * nao faz sentido.
 */
export class InvalidTransactionSeriesError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_TRANSACTION_SERIES', `serie de transacoes invalida: ${reason}`);
  }
}
