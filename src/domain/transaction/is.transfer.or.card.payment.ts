import { type Transaction } from './transaction.entity.ts';
import { type Category } from '../category/category.entity.ts';

/**
 * Decide se `transaction` e uma transferencia entre contas ou um pagamento de fatura de
 * cartao de credito (spec 018, RF-22) - regra formal de 3 condicoes combinadas por OR:
 *
 * (a) `transaction.transferGroupId` preenchido (transferencia criada pela operacao nativa,
 *     spec 016, RF-3/RF-5);
 * (b) `transaction.cardPaymentGroupId` preenchido (pagamento de fatura pela operacao nativa,
 *     spec 016, RF-6);
 * (c) a categoria vinculada tem `isSystemTransfer`/`isSystemCardPayment` (spec 016, RF-1/RF-2).
 *
 * A condicao (c) existe para compatibilidade retroativa: uma transferencia antiga, lancada
 * manualmente antes de existir a operacao nativa, nunca teve `transferGroupId` preenchido -
 * so a condicao (a)/(b) nao bastaria para excluir esses lancamentos dos totais mesmo depois
 * de `MigrateTransferCategoryUseCase` promover a categoria "TRANSFERENCIAS" para
 * `isSystemTransfer: true`. `category` pode ser `undefined` (ex.: indice de categoria nao
 * encontrou a categoria vinculada) - nesse caso so (a)/(b) valem, nunca lanca.
 *
 * Funcao pura, zero I/O (rule 10): usada pelo domínio do forecast (junto de
 * `excludedCategoryIds`, ver `calculateMonthlyForecast`) e espelhada pelo filtro do Dashboard
 * sobre `TransactionDto` (`groupTransactionsByCategory`), que não pode importar esta função
 * porque opera sobre um DTO IPC, não a entidade - um teste de paridade garante que as duas
 * nunca decidem diferente para o mesmo caso.
 */
export function isTransferOrCardPayment(
  transaction: Pick<Transaction, 'transferGroupId' | 'cardPaymentGroupId'>,
  category: Pick<Category, 'isSystemTransfer' | 'isSystemCardPayment'> | undefined,
): boolean {
  return (
    transaction.transferGroupId !== null ||
    transaction.cardPaymentGroupId !== null ||
    (category?.isSystemTransfer ?? false) ||
    (category?.isSystemCardPayment ?? false)
  );
}
