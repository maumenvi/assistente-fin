import { type Transaction } from '../../../../domain/transaction/transaction.entity.ts';

/**
 * Por que o app recusa mexer numa transacao pelo bloco (spec 029, R3, U1): transferencias e
 * pagamentos de fatura ficam fora da v1; parcela solta so se apaga pelo grupo (`installmentPurchase`).
 * Devolve `null` quando a operacao pode seguir.
 */
export function refusalForUnsupportedTransaction(transaction: Transaction, kind: 'update' | 'delete'): string | null {
  if (transaction.transferGroupId !== null) return 'transferencia fica fora desta versao';
  if (transaction.cardPaymentGroupId !== null) return 'pagamento de fatura fica fora desta versao';
  if (kind === 'delete' && transaction.installmentGroupId !== null) {
    return 'parcela nao se apaga sozinha: use installmentPurchase com delete ou cancelRemaining';
  }
  return null;
}
