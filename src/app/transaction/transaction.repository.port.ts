import { type Transaction } from '../../domain/transaction/transaction.entity.ts';

/**
 * Porta de persistencia de transacoes (spec 001, RF-5, RF-20).
 *
 * Toda operacao de leitura/remocao recebe `userId` e so enxerga transacoes daquele usuario -
 * isolamento por usuario (RF-16) e responsabilidade do repositorio, nao da borda.
 */
export interface TransactionRepository {
  /** Insere ou atualiza a transacao (chave: `transaction.id`). */
  save(transaction: Transaction): Promise<void>;

  /** Busca por id dentro do escopo do usuario. `null` se nao existir ou for de outro. */
  findById(userId: string, id: string): Promise<Transaction | null>;

  /** Lista as transacoes do usuario, ordenadas por data (mais recente primeiro). */
  listByUser(userId: string): Promise<Transaction[]>;

  /** Remove a transacao do usuario. Silencioso se ela nao existir nesse escopo. */
  delete(userId: string, id: string): Promise<void>;

  /**
   * Acha uma transacao ja persistida que bate a chave de deduplicacao de `candidate`
   * (mesma conta, tipo, valor e dia calendario - CA-5, plan.md riscos item 3). `null` se
   * nao houver nenhuma.
   */
  findDuplicate(candidate: Transaction): Promise<Transaction | null>;

  /**
   * Lista as transacoes de despesa (`type: 'expense'`) de uma conta especifica cuja `date`
   * cai dentro de `[from, to]` (ambos inclusivos), isolado por `userId` (spec 008, RF-5).
   * Usado pelo calculo da fatura de cartao de credito.
   */
  listExpensesByAccountAndDateRange(
    userId: string,
    accountId: string,
    from: Date,
    to: Date,
  ): Promise<Transaction[]>;

  /**
   * Lista todas as parcelas do grupo de parcelamento `groupId`, isolado por `userId` (spec
   * 009, RF-4, RF-8). Usado pelo cancelamento em lote e pela exibicao "parcela X de Y".
   */
  listByInstallmentGroup(userId: string, groupId: string): Promise<Transaction[]>;

  /**
   * Busca a transacao vinculada ao `FixedExpense` de id `fixedExpenseId` (spec 015), isolado
   * por `userId`. `null` se nao houver (gasto fixo ainda nao marcado como pago, ou ja
   * desmarcado). 1:1 por natureza (ver `Transaction.fixedExpenseId`) - se por algum motivo
   * houver mais de uma linha, devolve a mais recente.
   */
  findByFixedExpenseId(userId: string, fixedExpenseId: string): Promise<Transaction | null>;

  /**
   * Lista as duas pontas de uma transferencia (spec 016, RF-5), isolado por `userId`. Vazio
   * se o grupo nao existir/nao pertencer ao usuario. Usado pela edicao/exclusao atomica.
   */
  listByTransferGroup(userId: string, groupId: string): Promise<Transaction[]>;

  /**
   * Lista as duas pontas de um pagamento de fatura de cartao (spec 016, RF-6), isolado por
   * `userId`. Vazio se o grupo nao existir/nao pertencer ao usuario. Mesma mecanica de
   * `listByTransferGroup`.
   */
  listByCardPaymentGroup(userId: string, groupId: string): Promise<Transaction[]>;

  /**
   * Busca a `Transaction` "SALDO INICIAL" de uma conta (spec 015, spec 018 RF-28), isolado
   * por `userId`. `null` se a conta nunca teve saldo inicial lancado (`openingBalanceCents`
   * era `0`/omitido na criacao). 1:1 por natureza (uma conta so pode ter uma "SALDO INICIAL"
   * ativa) - mesmo espirito de `findByFixedExpenseId`, nomeado pelo caso de uso especifico
   * (`UpdateAccountUseCase`), nao um `findByAccountAndCategory` generico sem outro uso hoje.
   */
  findOpeningBalanceTransaction(
    userId: string,
    accountId: string,
    categoryId: string,
  ): Promise<Transaction | null>;
}
