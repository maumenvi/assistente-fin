import { type Database } from '../../app/shared/database.port.ts';
import { type AppliedOpRepository } from '../../app/sync/applied.op.repository.port.ts';
import { type SyncHubUnitOfWork } from '../../app/sync/sync.hub.unit.of.work.port.ts';
import { FakeAppliedOpRepository } from './applied.op.repository.fake.ts';

/** Transacao do hub em memoria (testes): usa a `transaction` do banco dado. */
export class FakeSyncHubUnitOfWork implements SyncHubUnitOfWork {
  public readonly appliedOps = new FakeAppliedOpRepository();
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public run<T>(work: (tx: Database, appliedOps: AppliedOpRepository) => Promise<T>): Promise<T> {
    return this.database.transaction((tx) => work(tx, this.appliedOps));
  }
}
