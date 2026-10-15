import { type SyncChangeRepository, type SyncChangeRow } from '../../app/sync/sync.change.repository.port.ts';

/** Log de alteracoes em memoria (testes): quem escreve chama `record`, como fariam os triggers. */
export class FakeSyncChangeRepository implements SyncChangeRepository {
  private readonly rows: (SyncChangeRow & { userId: string })[] = [];
  private seq = 0;

  public record(userId: string, entity: string, entityId: string, kind: 'upsert' | 'delete'): void {
    this.seq += 1;
    this.rows.push({ seq: this.seq, userId, entity, entityId, kind });
  }

  public async listSince(userId: string, since: number, limit: number): Promise<SyncChangeRow[]> {
    return this.rows.filter((row) => row.userId === userId && row.seq > since).slice(0, limit);
  }

  public async maxSeq(userId: string): Promise<number> {
    return this.rows.filter((row) => row.userId === userId).reduce((max, row) => Math.max(max, row.seq), 0);
  }
}
