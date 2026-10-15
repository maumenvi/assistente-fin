import { optimisticStamp } from '../shared/optimistic.lock.ts';
import { type FixedExpense } from '../../domain/fixed-expense/fixed.expense.entity.ts';
import { type FixedExpenseRepository } from '../../app/fixed-expense/fixed.expense.repository.port.ts';

/** Adaptador falso (test double) de `FixedExpenseRepository`, em memoria de processo. */
export class FakeFixedExpenseRepository implements FixedExpenseRepository {
  /** Gastos fixos indexados por id. */
  private readonly byId = new Map<string, FixedExpense>();

  public async save(fixedExpense: FixedExpense): Promise<void> {
    this.byId.set(fixedExpense.id, optimisticStamp(this.byId.get(fixedExpense.id), fixedExpense, 'gasto fixo'));
  }

  public async findById(userId: string, id: string): Promise<FixedExpense | null> {
    const fixedExpense = this.byId.get(id);
    return fixedExpense && fixedExpense.userId === userId ? fixedExpense : null;
  }

  public async listByUser(userId: string): Promise<FixedExpense[]> {
    return [...this.byId.values()]
      .filter((fixedExpense) => fixedExpense.userId === userId)
      .sort((a, b) => a.dueDay - b.dueDay);
  }

  public async delete(userId: string, id: string): Promise<void> {
    const fixedExpense = this.byId.get(id);
    if (fixedExpense && fixedExpense.userId === userId) {
      this.byId.delete(id);
    }
  }
}
