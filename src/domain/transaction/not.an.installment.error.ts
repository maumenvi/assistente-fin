import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando o cancelamento em lote de parcelas (spec 009, RF-8) e chamado a partir de
 * uma transacao que nao e parcela de uma compra parcelada (`installmentGroupId` nulo).
 */
export class NotAnInstallmentError extends DomainError {
  public constructor() {
    super('NOT_AN_INSTALLMENT', 'transacao nao e parcela de uma compra parcelada');
  }
}
