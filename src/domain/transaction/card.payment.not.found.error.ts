import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando o `cardPaymentGroupId` informado (editar/excluir um pagamento de fatura,
 * spec 016, RF-6) nao corresponde a nenhuma transacao, ou corresponde a transacoes que nao
 * pertencem ao usuario.
 */
export class CardPaymentNotFoundError extends DomainError {
  public constructor() {
    super('CARD_PAYMENT_NOT_FOUND', 'pagamento de fatura nao encontrado');
  }
}
