import { optimisticStamp } from '../shared/optimistic.lock.ts';
import { type PurchaseSimulation } from '../../domain/simulation/simulation.entity.ts';
import { type SimulationRepository } from '../../app/simulation/simulation.repository.port.ts';

/** Adaptador falso (test double) de `SimulationRepository`, em memoria de processo. */
export class FakeSimulationRepository implements SimulationRepository {
  /** Simulacoes indexadas por id. */
  private readonly byId = new Map<string, PurchaseSimulation>();

  public async save(simulation: PurchaseSimulation): Promise<void> {
    this.byId.set(simulation.id, optimisticStamp(this.byId.get(simulation.id), simulation, 'simulacao'));
  }

  public async findById(userId: string, id: string): Promise<PurchaseSimulation | null> {
    const simulation = this.byId.get(id);
    return simulation && simulation.userId === userId ? simulation : null;
  }

  public async listByUser(userId: string): Promise<PurchaseSimulation[]> {
    return [...this.byId.values()].filter((simulation) => simulation.userId === userId);
  }

  public async delete(userId: string, id: string): Promise<void> {
    const simulation = this.byId.get(id);
    if (simulation && simulation.userId === userId) {
      this.byId.delete(id);
    }
  }
}
