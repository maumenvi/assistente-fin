/**
 * Um lancamento acompanhado dos dados da sua categoria (spec 003, RF-14, CA-8).
 *
 * As listagens devolvem isto em vez da entidade pura porque a entidade so guarda o
 * `categoryId`: quem lista precisa do nome para exibir e do "pendente" para o filtro, e nem
 * um nem outro sao derivaveis do lancamento sozinho - dependem do agregado `Category` e de
 * qual delas e a padrao do usuario.
 */
export interface WithCategory<T> {
  readonly item: T;
  /** Nome ja normalizado (MAIUSCULAS) da categoria vinculada. */
  readonly categoryName: string;
  /** `true` quando o vinculo e com a categoria padrao do usuario (RF-14, CA-8). */
  readonly pendingClassification: boolean;
  /**
   * `true` quando a categoria vinculada e gerada pelo sistema (`isSystemOpeningBalance` /
   * `isSystemAdjustment` / `isSystemBalance`) - lancamento sintetico ("Saldo inicial",
   * "Ajuste", "Saldo"), nao um gasto/ganho real do usuario. Usado pela UI/MCP para nao
   * misturar essas linhas em relatorios "normais" (gastos por categoria, etc.) nem permitir
   * edita-las/exclui-las livremente.
   */
  readonly isSystemCategory: boolean;
  /**
   * `true` quando a categoria vinculada e a categoria de sistema de transferencia entre
   * contas (spec 016, RF-1). Dimensao propria, separada de `isSystemCategory`: transferencia
   * e editavel/excluivel normalmente via `transaction.updateTransfer`/`deleteTransfer`, entao
   * a UI nao deve desabilitar essas acoes nela (spec 018, RF-23).
   */
  readonly isSystemTransfer: boolean;
  /**
   * `true` quando a categoria vinculada e a categoria de sistema de pagamento de fatura de
   * cartao de credito (spec 016, RF-2). Mesma dimensao/racional de `isSystemTransfer`
   * (spec 018, RF-23).
   */
  readonly isSystemCardPayment: boolean;
}
