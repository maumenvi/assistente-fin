import { optimisticStamp } from '../shared/optimistic.lock.ts';
import { type ProjectionScenario } from '../../domain/scenario/projection.scenario.entity.ts';
import { type ScenarioRepository } from '../../app/scenario/scenario.repository.port.ts';

/** Adaptador falso (test double) de `ScenarioRepository`, em memoria de processo. */
export class FakeScenarioRepository implements ScenarioRepository {
  /** Cenarios indexados por id. */
  private readonly byId = new Map<string, ProjectionScenario>();

  public async save(scenario: ProjectionScenario): Promise<void> {
    this.byId.set(scenario.id, optimisticStamp(this.byId.get(scenario.id), scenario, 'cenario'));
  }

  public async findById(userId: string, id: string): Promise<ProjectionScenario | null> {
    const scenario = this.byId.get(id);
    return scenario && scenario.userId === userId ? scenario : null;
  }

  public async listByUser(userId: string): Promise<ProjectionScenario[]> {
    return [...this.byId.values()]
      .filter((scenario) => scenario.userId === userId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public async delete(userId: string, id: string): Promise<void> {
    const scenario = this.byId.get(id);
    if (scenario && scenario.userId === userId) {
      this.byId.delete(id);
    }
  }
}
