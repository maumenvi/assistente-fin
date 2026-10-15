import { optimisticStamp } from '../shared/optimistic.lock.ts';
import { type SpendingLimit } from '../../domain/spending-limit/spending.limit.entity.ts';
import { type SpendingLimitRepository } from '../../app/spending-limit/spending.limit.repository.port.ts';

/** Adaptador falso (test double) de `SpendingLimitRepository`, em memoria de processo. */
export class FakeSpendingLimitRepository implements SpendingLimitRepository {
  /** Limites indexados por id. */
  private readonly byId = new Map<string, SpendingLimit>();

  public async save(spendingLimit: SpendingLimit): Promise<void> {
    this.byId.set(spendingLimit.id, optimisticStamp(this.byId.get(spendingLimit.id), spendingLimit, 'limite'));
  }

  public async findById(userId: string, id: string): Promise<SpendingLimit | null> {
    const spendingLimit = this.byId.get(id);
    return spendingLimit && spendingLimit.userId === userId ? spendingLimit : null;
  }

  public async listByUser(userId: string): Promise<SpendingLimit[]> {
    return [...this.byId.values()]
      .filter((spendingLimit) => spendingLimit.userId === userId)
      .sort((a, b) => (a.categoryId < b.categoryId ? -1 : 1));
  }

  public async delete(userId: string, id: string): Promise<void> {
    const spendingLimit = this.byId.get(id);
    if (spendingLimit && spendingLimit.userId === userId) {
      this.byId.delete(id);
    }
  }
}
