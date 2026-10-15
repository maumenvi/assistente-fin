import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando a conta nao existe, ou existe mas nao pertence ao usuario (RF-16, CA-14). */
export class AccountNotFoundError extends DomainError {
  public constructor() {
    super('ACCOUNT_NOT_FOUND', 'conta nao encontrada');
  }
}
