import { optimisticStamp } from '../shared/optimistic.lock.ts';
import { type Transaction } from '../../domain/transaction/transaction.entity.ts';
import { type TransactionRepository } from '../../app/transaction/transaction.repository.port.ts';
import { sameCalendarDay } from '../../libs/date/same.calendar.day.ts';
import { startOfUtcDay } from '../../libs/date/start.of.utc.day.ts';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Adaptador falso (test double) de `TransactionRepository`, em memoria de processo. */
export class FakeTransactionRepository implements TransactionRepository {
  /** Transacoes indexadas por id. */
  private readonly byId = new Map<string, Transaction>();

  public async save(transaction: Transaction): Promise<void> {
    this.byId.set(transaction.id, optimisticStamp(this.byId.get(transaction.id), transaction, 'transacao'));
  }

  public async findById(userId: string, id: string): Promise<Transaction | null> {
    const transaction = this.byId.get(id);
    return transaction && transaction.userId === userId ? transaction : null;
  }

  public async listByUser(userId: string): Promise<Transaction[]> {
    return [...this.byId.values()]
      .filter((transaction) => transaction.userId === userId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  public async delete(userId: string, id: string): Promise<void> {
    const transaction = this.byId.get(id);
    if (transaction && transaction.userId === userId) {
      this.byId.delete(id);
    }
  }

  public async findDuplicate(candidate: Transaction): Promise<Transaction | null> {
    for (const transaction of this.byId.values()) {
      if (
        transaction.userId === candidate.userId &&
        transaction.accountId === candidate.accountId &&
        transaction.type === candidate.type &&
        transaction.amount.equals(candidate.amount) &&
        sameCalendarDay(transaction.date, candidate.date)
      ) {
        return transaction;
      }
    }
    return null;
  }

  public async listExpensesByAccountAndDateRange(
    userId: string,
    accountId: string,
    from: Date,
    to: Date,
  ): Promise<Transaction[]> {
    const rangeStart = startOfUtcDay(from);
    const rangeEnd = new Date(startOfUtcDay(to).getTime() + ONE_DAY_MS);

    return [...this.byId.values()]
      .filter(
        (transaction) =>
          transaction.userId === userId &&
          transaction.accountId === accountId &&
          transaction.type === 'expense' &&
          transaction.date >= rangeStart &&
          transaction.date < rangeEnd,
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  public async listByInstallmentGroup(userId: string, groupId: string): Promise<Transaction[]> {
    return [...this.byId.values()]
      .filter((transaction) => transaction.userId === userId && transaction.installmentGroupId === groupId)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async findByFixedExpenseId(userId: string, fixedExpenseId: string): Promise<Transaction | null> {
    const matches = [...this.byId.values()]
      .filter((transaction) => transaction.userId === userId && transaction.fixedExpenseId === fixedExpenseId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    return matches[0] ?? null;
  }

  public async listByTransferGroup(userId: string, groupId: string): Promise<Transaction[]> {
    return [...this.byId.values()]
      .filter((transaction) => transaction.userId === userId && transaction.transferGroupId === groupId)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async listByCardPaymentGroup(userId: string, groupId: string): Promise<Transaction[]> {
    return [...this.byId.values()]
      .filter((transaction) => transaction.userId === userId && transaction.cardPaymentGroupId === groupId)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async findOpeningBalanceTransaction(
    userId: string,
    accountId: string,
    categoryId: string,
  ): Promise<Transaction | null> {
    const matches = [...this.byId.values()].filter(
      (transaction) =>
        transaction.userId === userId &&
        transaction.accountId === accountId &&
        transaction.categoryId === categoryId,
    );
    return matches[0] ?? null;
  }
}
