import { type ScenarioApplication } from '../../domain/scenario/scenario.application.entity.ts';
import { type ScenarioApplicationRepository } from '../../app/scenario/scenario.application.repository.port.ts';

/** Adaptador falso (test double) de `ScenarioApplicationRepository`, em memoria de processo. */
export class FakeScenarioApplicationRepository implements ScenarioApplicationRepository {
  /** Aplicacoes indexadas por id. */
  private readonly byId = new Map<string, ScenarioApplication>();

  public async save(application: ScenarioApplication): Promise<void> {
    this.byId.set(application.id, application);
  }

  public async findById(userId: string, id: string): Promise<ScenarioApplication | null> {
    const application = this.byId.get(id);
    return application && application.userId === userId ? application : null;
  }

  public async findActiveByUser(userId: string): Promise<ScenarioApplication | null> {
    return [...this.byId.values()].find((application) => application.userId === userId) ?? null;
  }

  public async delete(userId: string, id: string): Promise<void> {
    const application = this.byId.get(id);
    if (application && application.userId === userId) {
      this.byId.delete(id);
    }
  }
}
