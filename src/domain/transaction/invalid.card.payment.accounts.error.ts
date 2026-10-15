import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando a operacao nativa de pagamento de fatura (spec 016, RF-6) recebe contas
 * incompativeis: `cardAccountId` que nao e `kind: 'credit-card'`, ou `payingAccountId` que e
 * `kind: 'credit-card'`. Pagar fatura sempre debita uma conta de saldo e baixa a divida de um
 * cartao - nunca o contrario, nunca as duas do mesmo lado.
 */
export class InvalidCardPaymentAccountsError extends DomainError {
  public constructor() {
    super(
      'INVALID_CARD_PAYMENT_ACCOUNTS',
      'a conta pagadora deve ser de saldo e a conta de cartao deve ser credit-card',
    );
  }
}
