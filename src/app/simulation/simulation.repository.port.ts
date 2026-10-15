import { type PurchaseSimulation } from '../../domain/simulation/simulation.entity.ts';

/**
 * Porta de persistencia de simulacoes de compra (spec 001, RF-9..RF-11).
 *
 * `PurchaseSimulation` e uma entidade persistida (plan.md, decisao 13) - `ApproveSimulation`
 * precisa achar a simulacao por `simulationId` depois de `SimulatePurchase` a ter criado.
 */
export interface SimulationRepository {
  /** Insere ou atualiza a simulacao (chave: `simulation.id`). */
  save(simulation: PurchaseSimulation): Promise<void>;

  /** Busca por id dentro do escopo do usuario. `null` se nao existir ou for de outro. */
  findById(userId: string, id: string): Promise<PurchaseSimulation | null>;

  /** Lista as simulacoes do usuario. */
  listByUser(userId: string): Promise<PurchaseSimulation[]>;

  /**
   * Remove a simulacao do usuario. Silencioso se ela nao existir nesse escopo. Usado por
   * `RestoreDataSnapshot` (spec 002, RF-38) ao limpar os dados antes de reimportar.
   */
  delete(userId: string, id: string): Promise<void>;
}
