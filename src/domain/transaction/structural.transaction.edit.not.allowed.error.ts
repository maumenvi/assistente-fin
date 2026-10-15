import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando `UpdateTransactionUseCase` (edicao generica do extrato) recebe uma
 * tentativa de mudar `amountCents`/`accountId`/`type`/`categoryId` de uma `Transaction`
 * estruturalmente vinculada - perna de transferencia (`transferGroupId`), perna de
 * pagamento de fatura (`cardPaymentGroupId`) ou o "SALDO INICIAL" de uma conta
 * (`isSystemOpeningBalance`).
 *
 * Cada um desses tres casos tem um caminho proprio que mantem as duas fontes em sincronia
 * (`UpdateTransferUseCase`/`UpdateCardPaymentUseCase` - replicam a mudanca nas duas pernas;
 * `UpdateAccountUseCase` - sincroniza `account.openingBalanceCents` junto, spec 018 RF-28).
 * Passar pelo `UpdateTransactionUseCase` generico desses tres campos quebraria essa
 * sincronia silenciosamente (a outra perna ou a conta ficariam com o valor antigo), entao a
 * edicao e rejeitada aqui em vez de aceita e ignorada.
 */
export class StructuralTransactionEditNotAllowedError extends DomainError {
  public constructor(reason: 'transfer' | 'card-payment' | 'opening-balance') {
    super('STRUCTURAL_TRANSACTION_EDIT_NOT_ALLOWED', buildMessage(reason));
  }
}

function buildMessage(reason: 'transfer' | 'card-payment' | 'opening-balance'): string {
  switch (reason) {
    case 'transfer':
      return 'valor/conta/tipo de uma perna de transferencia nao podem ser editados por aqui - use transaction.updateTransfer (so data/notas) ou exclua e recrie a transferencia';
    case 'card-payment':
      return 'valor/conta/tipo de uma perna de pagamento de fatura nao podem ser editados por aqui - use account.updateCreditCardPayment (so data/notas) ou exclua e recrie o pagamento';
    case 'opening-balance':
      return 'valor/data do "SALDO INICIAL" nao podem ser editados por aqui - use account.update (mantem a conta e a transacao sincronizadas)';
  }
}
