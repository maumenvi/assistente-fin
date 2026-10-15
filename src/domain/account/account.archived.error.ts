import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando a conta existe mas esta arquivada e a operacao exige uma conta ativa (spec 005, CA-10). */
export class AccountArchivedError extends DomainError {
  public constructor() {
    super('ACCOUNT_ARCHIVED', 'conta arquivada');
  }
}
