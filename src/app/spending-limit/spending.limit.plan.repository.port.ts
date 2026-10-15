import { type SpendingLimitPlan } from '../../domain/spending-limit/spending.limit.plan.entity.ts';

/**
 * Porta de persistencia de planos de limite de gasto (spec 016).
 *
 * Toda operacao de leitura/remocao recebe `userId` e so enxerga planos daquele usuario -
 * isolamento por usuario, mesmo padrao de `IncomeRepository`.
 */
export interface SpendingLimitPlanRepository {
  /** Insere ou atualiza o plano (chave: `plan.id`). */
  save(plan: SpendingLimitPlan): Promise<void>;

  /** Busca por id dentro do escopo do usuario. `null` se nao existir ou for de outro. */
  findById(userId: string, id: string): Promise<SpendingLimitPlan | null>;

  /** Lista os planos do usuario. */
  listByUser(userId: string): Promise<SpendingLimitPlan[]>;

  /** Remove o plano do usuario. Silencioso se ele nao existir nesse escopo. */
  delete(userId: string, id: string): Promise<void>;
}
