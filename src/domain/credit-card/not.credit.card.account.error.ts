import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando uma operacao de cartao de credito e chamada com uma conta de outro `kind` (spec 008, RF-5). */
export class NotCreditCardAccountError extends DomainError {
  public constructor() {
    super('NOT_CREDIT_CARD_ACCOUNT', 'conta nao e do tipo cartao de credito');
  }
}
