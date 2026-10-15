import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando a transacao nao existe, ou existe mas nao pertence ao usuario (RF-16, CA-14). */
export class TransactionNotFoundError extends DomainError {
  public constructor() {
    super('TRANSACTION_NOT_FOUND', 'transacao nao encontrada');
  }
}
