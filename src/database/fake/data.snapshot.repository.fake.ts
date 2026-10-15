import { type DataSnapshot } from '../../domain/scenario/data.snapshot.entity.ts';
import { type DataSnapshotRepository } from '../../app/scenario/data.snapshot.repository.port.ts';

/** Adaptador falso (test double) de `DataSnapshotRepository`, em memoria de processo. */
export class FakeDataSnapshotRepository implements DataSnapshotRepository {
  /** Snapshots indexados por id. */
  private readonly byId = new Map<string, DataSnapshot>();

  public async save(snapshot: DataSnapshot): Promise<void> {
    this.byId.set(snapshot.id, snapshot);
  }

  public async findById(userId: string, id: string): Promise<DataSnapshot | null> {
    const snapshot = this.byId.get(id);
    return snapshot && snapshot.userId === userId ? snapshot : null;
  }

  public async listByUser(userId: string): Promise<DataSnapshot[]> {
    return [...this.byId.values()]
      .filter((snapshot) => snapshot.userId === userId)
      .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
  }

  public async delete(userId: string, id: string): Promise<void> {
    const snapshot = this.byId.get(id);
    if (snapshot && snapshot.userId === userId) {
      this.byId.delete(id);
    }
  }
}
