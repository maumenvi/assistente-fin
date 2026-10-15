import { type AiBatch } from '../../app/ai-exchange/ai.batch.ts';
import { type AiBatchOp } from '../../app/ai-exchange/ai.batch.op.ts';
import { type AiBatchStore } from '../../app/ai-exchange/ai.batch.store.port.ts';

/** Diario em memoria para testes (spec 029). Os dados passam por JSON, como no SQLite. */
export class FakeAiBatchStore implements AiBatchStore {
  private readonly batches = new Map<string, AiBatch>();
  private readonly ops = new Map<string, AiBatchOp[]>();

  public async saveBatch(batch: AiBatch, ops: readonly AiBatchOp[]): Promise<void> {
    this.batches.set(batch.batchId, structuredClone(batch));
    this.ops.set(batch.batchId, ops.map((op) => structuredClone(op)));
  }

  public async findBatch(userId: string, batchId: string): Promise<AiBatch | null> {
    const found = this.batches.get(batchId);
    return found !== undefined && found.userId === userId ? structuredClone(found) : null;
  }

  public async listBatches(userId: string, limit: number): Promise<AiBatch[]> {
    return [...this.batches.values()]
      .filter((batch) => batch.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((batch) => structuredClone(batch));
  }

  public async listOps(batchId: string): Promise<AiBatchOp[]> {
    return (this.ops.get(batchId) ?? []).map((op) => structuredClone(op)).sort((a, b) => a.seq - b.seq);
  }

  public async findOpsByEntityId(entityId: string): Promise<AiBatchOp[]> {
    return [...this.ops.values()].flat().filter((op) => op.entityId === entityId).map((op) => structuredClone(op));
  }

  public async updateBatch(batch: AiBatch): Promise<void> {
    this.batches.set(batch.batchId, structuredClone(batch));
  }

  public async updateOp(op: AiBatchOp): Promise<void> {
    const list = this.ops.get(op.batchId) ?? [];
    this.ops.set(op.batchId, list.map((existing) => (existing.seq === op.seq ? structuredClone(op) : existing)));
  }

  public async deleteBatch(userId: string, batchId: string): Promise<void> {
    if (this.batches.get(batchId)?.userId === userId) {
      this.batches.delete(batchId);
      this.ops.delete(batchId);
    }
  }
}
