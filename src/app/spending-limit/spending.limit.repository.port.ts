import { type SpendingLimit } from '../../domain/spending-limit/spending.limit.entity.ts';

/**
 * Porta de persistencia de limites de gasto (spec 001, RF-4, RF-20).
 *
 * Toda operacao de leitura/remocao recebe `userId` e so enxerga limites daquele usuario -
 * isolamento por usuario (RF-16) e responsabilidade do repositorio, nao da borda.
 */
export interface SpendingLimitRepository {
  /** Insere ou atualiza o limite (chave: `spendingLimit.id`). */
  save(spendingLimit: SpendingLimit): Promise<void>;

  /** Busca por id dentro do escopo do usuario. `null` se nao existir ou for de outro. */
  findById(userId: string, id: string): Promise<SpendingLimit | null>;

  /** Lista os limites do usuario, ordenados por categoria. */
  listByUser(userId: string): Promise<SpendingLimit[]>;

  /** Remove o limite do usuario. Silencioso se ele nao existir nesse escopo. */
  delete(userId: string, id: string): Promise<void>;
}
