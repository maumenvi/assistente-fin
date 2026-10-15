import { type TransactionType } from '../../domain/transaction/transaction.type.ts';
import { isFixedExpenseTransaction } from '../../domain/transaction/is.fixed.expense.transaction.ts';
import { type DashboardTransaction } from './dashboard.transaction.ts';
import { type DashboardAccount } from './dashboard.account.ts';
import { type CategoryTotal } from './category.total.ts';
import { isInMonth } from './is.in.month.ts';

/**
 * Agrupa `transactions` do tipo `type`, no `month` filtrado, por categoria - soma por
 * `categoryId` (nunca por nome, que pode ser renomeado, spec 001 RF-7), ordenado do maior
 * pro menor total (spec 011, RF-13, RF-15).
 *
 * Exclui (spec 011, RF-10, RF-11; spec 016, RF-8; spec 018, RF-22; spec 019):
 * - transacoes de categoria de sistema (`isSystemCategory`) - "Saldo inicial"/"Ajuste"/
 *   "Saldo" sao lancamentos sinteticos, nao gastos/ganhos reais do usuario (revisao do bug
 *   de saldo inicial vs. saldo atual);
 * - transacoes de transferencia (`transferGroupId`) ou de pagamento de fatura
 *   (`cardPaymentGroupId`) - saida numa conta e entrada noutra, neutras no patrimonio total,
 *   nao ganho/gasto real (spec 016, RF-8; nao afeta saldo por conta nem o Extrato, RF-9);
 * - transacoes cuja categoria tem `isSystemTransfer`/`isSystemCardPayment` mesmo sem o grupo
 *   preenchido (spec 018, RF-22) - compatibilidade retroativa: transferencia/pagamento
 *   lancado manualmente antes de existir a operacao nativa, cuja categoria ja foi promovida
 *   (`MigrateTransferCategoryUseCase`) mas cuja `Transaction` nunca teve `transferGroupId`/
 *   `cardPaymentGroupId`;
 * - QUALQUER entrada (`type: 'income'`) numa conta `kind: 'credit-card'` (spec 019) -
 *   incondicional, independente de flag/categoria: cartao de credito nunca e ativo
 *   disponivel, uma entrada nele e sempre baixa de divida (pagamento de fatura, estorno,
 *   ajuste), nunca ganho real. Cobre o caso que `cardPaymentGroupId`/`isSystemCardPayment`
 *   sozinhos nao pegavam - uma entrada antiga em conta-cartao sem nenhum dos dois (ex.:
 *   pagamento de fatura lancado manualmente numa categoria comum, antes de existir a
 *   operacao nativa ou a migracao de categoria);
 * - transacoes geradas por gasto fixo (`fixedExpenseId`, spec 021, RF-59/RF-60) - o gasto fixo
 *   e contado direto pelo `expectedAmount` em `sumFixedExpensesByCategory`, entao somar a
 *   transacao tambem contaria o mesmo gasto duas vezes;
 * - transacoes de conta marcada `isBenefit: true` (exibidas separadamente, RF-14).
 *
 * Gasto de conta `kind: 'credit-card'` **entra normalmente**, discriminado por categoria: a
 * opcao `excludeCreditCardAccounts`, que existia para nao duplicar com o bloco consolidado
 * "Resumo de cartoes", foi removida junto com esse bloco (spec 019 RF-31 / spec 020 RF-49).
 */
export function groupTransactionsByCategory(
  transactions: readonly DashboardTransaction[],
  accounts: readonly DashboardAccount[],
  month: { year: number; month: number },
  type: TransactionType,
): readonly CategoryTotal[] {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const totals = new Map<string, CategoryTotal>();

  for (const tx of transactions) {
    if (tx.type !== type || !isInMonth(tx.date, month)) continue;
    if (tx.isSystemCategory) continue;
    // spec 018, RF-22: as 3 condicoes combinadas por OR - transferGroupId/cardPaymentGroupId
    // preenchidos cobrem a operacao nativa (spec 016, RF-3/RF-6); isSystemTransfer/
    // isSystemCardPayment cobrem transferencias/pagamentos antigos, lancados manualmente
    // antes da operacao nativa existir, cuja categoria ja foi promovida mas cuja Transaction
    // nunca teve o grupo preenchido.
    if (tx.transferGroupId !== null || tx.cardPaymentGroupId !== null) continue;
    if (tx.isSystemTransfer || tx.isSystemCardPayment) continue;
    // spec 021 (RF-59/RF-60): transacao gerada por gasto fixo nao conta - o gasto fixo que a
    // originou ja e somado por `sumFixedExpensesByCategory`. Sao as que sobraram das marcacoes
    // de "pago" feitas antes da spec 021; continuam no Extrato e no saldo, so nao como gasto.
    if (isFixedExpenseTransaction(tx)) continue;
    const account = accountById.get(tx.accountId);
    // spec 019: cartao de credito nunca e ganho, incondicional - pega qualquer entrada em
    // conta-cartao que as flags acima nao cobriram (dado antigo, sem vinculo nenhum).
    if (type === 'income' && account?.kind === 'credit-card') continue;
    if (account?.isBenefit) continue;

    const existing = totals.get(tx.categoryId);
    if (existing) {
      totals.set(tx.categoryId, { ...existing, totalCents: existing.totalCents + tx.amountCents });
    } else {
      totals.set(tx.categoryId, {
        categoryId: tx.categoryId,
        categoryName: tx.categoryName,
        totalCents: tx.amountCents,
      });
    }
  }

  return [...totals.values()].sort((a, b) => b.totalCents - a.totalCents);
}
