/**
 * `true` quando a transacao foi gerada por um gasto fixo (spec 021, RF-59/RF-60).
 *
 * Uma transacao assim **nunca** conta como gasto - nem no Dashboard, nem na previsao - porque o
 * gasto fixo que a originou ja e contado pelo proprio `expectedAmount` (RF-57). Contar as duas
 * seria somar o mesmo gasto duas vezes.
 *
 * Desde a spec 021 o app **nao cria mais** transacoes assim: marcar um gasto fixo como pago
 * passou a ser so um marcador de controle (RF-58). As que existem sao historico das marcacoes
 * feitas antes dessa mudanca - elas permanecem no banco, visiveis no Extrato e somando no saldo
 * da conta (o dinheiro saiu de fato), so deixam de ser contadas como gasto do mes.
 *
 * **A tipagem e estrutural de proposito**, e nao `Transaction`: o Dashboard opera sobre
 * `TransactionDto` (objeto da IPC) e a previsao sobre a entidade `Transaction`. Tipar pela
 * entidade impediria o renderer de importar esta funcao - foi o que aconteceu com
 * `is.transfer.or.card.payment.ts` (spec 018), que hoje nao tem consumidor em producao enquanto
 * a mesma regra vive em tres copias sincronizadas por um teste de paridade. Aqui os tres
 * consumidores importam esta funcao e o compilador garante a coerencia.
 */
export function isFixedExpenseTransaction(transaction: {
  readonly fixedExpenseId: string | null;
}): boolean {
  return transaction.fixedExpenseId !== null;
}
