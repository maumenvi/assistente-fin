import { optimisticStamp } from '../shared/optimistic.lock.ts';
import { type Income } from '../../domain/income/income.entity.ts';
import { type IncomeRepository } from '../../app/income/income.repository.port.ts';

/** Adaptador falso (test double) de `IncomeRepository`, com estado em memoria de processo. */
export class FakeIncomeRepository implements IncomeRepository {
  /** Ganhos indexados por id. */
  private readonly byId = new Map<string, Income>();

  public async save(income: Income): Promise<void> {
    this.byId.set(income.id, optimisticStamp(this.byId.get(income.id), income, 'ganho'));
  }

  public async findById(userId: string, id: string): Promise<Income | null> {
    const income = this.byId.get(id);
    return income && income.userId === userId ? income : null;
  }

  public async listByUser(userId: string): Promise<Income[]> {
    return [...this.byId.values()]
      .filter((income) => income.userId === userId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  public async delete(userId: string, id: string): Promise<void> {
    const income = this.byId.get(id);
    if (income && income.userId === userId) {
      this.byId.delete(id);
    }
  }
}
