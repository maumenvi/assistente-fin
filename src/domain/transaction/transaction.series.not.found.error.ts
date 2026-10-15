import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando a serie nao existe, ou existe mas nao pertence ao usuario (spec 003, RF-25;
 * mesma resposta para as duas situacoes, como em `TransactionNotFoundError`).
 */
export class TransactionSeriesNotFoundError extends DomainError {
  public constructor() {
    super('TRANSACTION_SERIES_NOT_FOUND', 'serie de transacoes nao encontrada');
  }
}
