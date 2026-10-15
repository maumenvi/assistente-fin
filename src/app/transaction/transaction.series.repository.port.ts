import { type TransactionSeries } from '../../domain/transaction/transaction.series.entity.ts';

/**
 * Porta de persistencia de series de transacoes (spec 003, RF-25).
 *
 * Toda operacao recebe `userId` e so enxerga series daquele usuario - isolamento por usuario
 * (001/RF-16). Sem `delete`: uma serie so termina, nunca some - "encerrar" (4.6) ajusta a
 * data final da recorrencia e apaga as ocorrencias futuras, mas a serie fica como historico
 * das ocorrencias que ja aconteceram.
 */
export interface TransactionSeriesRepository {
  /** Insere ou atualiza a serie (chave: `series.id`), com trava otimista (RF-31). */
  save(series: TransactionSeries): Promise<void>;

  /** Busca por id dentro do escopo do usuario. `null` se nao existir ou for de outro. */
  findById(userId: string, id: string): Promise<TransactionSeries | null>;

  /** Lista as series do usuario, ordenadas por `anchorDate` (mais recente primeiro). */
  listByUser(userId: string): Promise<TransactionSeries[]>;
}
