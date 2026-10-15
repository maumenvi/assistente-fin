import { optimisticStamp } from '../shared/optimistic.lock.ts';
import { type SpendingLimitPlan } from '../../domain/spending-limit/spending.limit.plan.entity.ts';
import { type SpendingLimitPlanRepository } from '../../app/spending-limit/spending.limit.plan.repository.port.ts';

/** Adaptador falso (test double) de `SpendingLimitPlanRepository`, com estado em memoria de processo. */
export class FakeSpendingLimitPlanRepository implements SpendingLimitPlanRepository {
  /** Planos indexados por id. */
  private readonly byId = new Map<string, SpendingLimitPlan>();

  public async save(plan: SpendingLimitPlan): Promise<void> {
    this.byId.set(plan.id, optimisticStamp(this.byId.get(plan.id), plan, 'plano de limite'));
  }

  public async findById(userId: string, id: string): Promise<SpendingLimitPlan | null> {
    const plan = this.byId.get(id);
    return plan && plan.userId === userId ? plan : null;
  }

  public async listByUser(userId: string): Promise<SpendingLimitPlan[]> {
    return [...this.byId.values()].filter((plan) => plan.userId === userId);
  }

  public async delete(userId: string, id: string): Promise<void> {
    const plan = this.byId.get(id);
    if (plan && plan.userId === userId) {
      this.byId.delete(id);
    }
  }
}
