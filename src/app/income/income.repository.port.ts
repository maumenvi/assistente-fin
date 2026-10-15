import { type Income } from '../../domain/income/income.entity.ts';

/**
 * Porta de persistencia de ganhos (spec 001, RF-2, RF-20).
 *
 * Toda operacao de leitura/remocao recebe `userId` e so enxerga ganhos daquele usuario -
 * isolamento por usuario (RF-16) e responsabilidade do repositorio, nao da borda.
 */
export interface IncomeRepository {
  /** Insere ou atualiza o ganho (chave: `income.id`). */
  save(income: Income): Promise<void>;

  /** Busca por id dentro do escopo do usuario. `null` se nao existir ou for de outro. */
  findById(userId: string, id: string): Promise<Income | null>;

  /** Lista os ganhos do usuario, ordenados por data (mais recente primeiro). */
  listByUser(userId: string): Promise<Income[]>;

  /** Remove o ganho do usuario. Silencioso se ele nao existir nesse escopo. */
  delete(userId: string, id: string): Promise<void>;
}
