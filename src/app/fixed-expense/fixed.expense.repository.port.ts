import { type FixedExpense } from '../../domain/fixed-expense/fixed.expense.entity.ts';

/**
 * Porta de persistencia de gastos fixos (spec 001, RF-3, RF-20).
 *
 * Toda operacao de leitura/remocao recebe `userId` e so enxerga gastos daquele usuario -
 * isolamento por usuario (RF-16) e responsabilidade do repositorio, nao da borda.
 */
export interface FixedExpenseRepository {
  /** Insere ou atualiza o gasto fixo (chave: `fixedExpense.id`). */
  save(fixedExpense: FixedExpense): Promise<void>;

  /** Busca por id dentro do escopo do usuario. `null` se nao existir ou for de outro. */
  findById(userId: string, id: string): Promise<FixedExpense | null>;

  /** Lista os gastos fixos do usuario, ordenados por dia de vencimento. */
  listByUser(userId: string): Promise<FixedExpense[]>;

  /** Remove o gasto fixo do usuario. Silencioso se ele nao existir nesse escopo. */
  delete(userId: string, id: string): Promise<void>;
}
