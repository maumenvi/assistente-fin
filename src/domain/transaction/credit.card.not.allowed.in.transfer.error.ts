import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando a operacao nativa de transferencia (spec 016, RF-3, RF-4) recebe uma conta
 * de cartao de credito como origem ou destino. Cartao de credito nao e conta de saldo -
 * transferir entre contas e diferente de pagar fatura (`CreateCardPaymentUseCase`).
 */
export class CreditCardNotAllowedInTransferError extends DomainError {
  public constructor() {
    super('CREDIT_CARD_NOT_ALLOWED_IN_TRANSFER', 'cartao de credito nao pode ser origem ou destino de uma transferencia');
  }
}
