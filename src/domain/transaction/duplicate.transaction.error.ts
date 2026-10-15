import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando uma transacao bate a chave de deduplicacao de outra ja registrada
 * (spec 001, CA-5; plan.md, riscos item 3): mesma conta, tipo, valor e dia calendario.
 */
export class DuplicateTransactionError extends DomainError {
  public constructor() {
    super('DUPLICATE_TRANSACTION', 'transacao duplicada (mesma conta, tipo, valor e dia)');
  }
}
