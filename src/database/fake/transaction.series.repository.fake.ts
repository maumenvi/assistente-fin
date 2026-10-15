import { optimisticStamp } from '../shared/optimistic.lock.ts';
import { type TransactionSeries } from '../../domain/transaction/transaction.series.entity.ts';
import { type TransactionSeriesRepository } from '../../app/transaction/transaction.series.repository.port.ts';

/** Adaptador falso (test double) de `TransactionSeriesRepository`, em memoria de processo. */
export class FakeTransactionSeriesRepository implements TransactionSeriesRepository {
  /** Series indexadas por id. */
  private readonly byId = new Map<string, TransactionSeries>();

  public async save(series: TransactionSeries): Promise<void> {
    this.byId.set(series.id, optimisticStamp(this.byId.get(series.id), series, 'serie de transacoes'));
  }

  public async findById(userId: string, id: string): Promise<TransactionSeries | null> {
    const series = this.byId.get(id);
    return series && series.userId === userId ? series : null;
  }

  public async listByUser(userId: string): Promise<TransactionSeries[]> {
    return [...this.byId.values()]
      .filter((series) => series.userId === userId)
      .sort((a, b) => b.anchorDate.getTime() - a.anchorDate.getTime());
  }
}
