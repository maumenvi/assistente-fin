import { optimisticStamp } from '../shared/optimistic.lock.ts';
import { type PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';
import { type PreRegistrationRepository } from '../../app/pre-registration/pre.registration.repository.port.ts';

/** `PreRegistrationRepository` em memoria (spec 022). */
export class FakePreRegistrationRepository implements PreRegistrationRepository {
  private readonly byId = new Map<string, PreRegistration>();

  public async save(preRegistration: PreRegistration): Promise<void> {
    this.byId.set(preRegistration.id, optimisticStamp(this.byId.get(preRegistration.id), preRegistration, 'pre-registro'));
  }

  public async findById(userId: string, id: string): Promise<PreRegistration | null> {
    const found = this.byId.get(id);
    return found && found.userId === userId ? found : null;
  }

  public async listByUser(userId: string): Promise<PreRegistration[]> {
    return [...this.byId.values()]
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async countPending(userId: string): Promise<number> {
    return (await this.listByUser(userId)).length;
  }

  public async findByDedupKey(userId: string, dedupKey: string): Promise<PreRegistration[]> {
    return (await this.listByUser(userId)).filter((p) => p.dedupKey === dedupKey);
  }

  public async delete(userId: string, id: string): Promise<void> {
    if (this.byId.get(id)?.userId === userId) this.byId.delete(id);
  }
}
