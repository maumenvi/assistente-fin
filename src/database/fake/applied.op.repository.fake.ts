import { type AppliedOp, type AppliedOpRepository } from '../../app/sync/applied.op.repository.port.ts';

/** `AppliedOpRepository` em memoria (spec 022). */
export class FakeAppliedOpRepository implements AppliedOpRepository {
  private readonly byId = new Map<string, AppliedOp>();

  public async find(opId: string): Promise<AppliedOp | null> {
    return this.byId.get(opId) ?? null;
  }

  public async save(op: AppliedOp): Promise<void> {
    this.byId.set(op.opId, op);
  }

  public async producedBy(deviceId: string, entity: string, entityId: string, version: string): Promise<boolean> {
    return [...this.byId.values()].some(
      (op) => op.deviceId === deviceId && op.entity === entity && op.entityId === entityId && op.resultVersion === version,
    );
  }
}
