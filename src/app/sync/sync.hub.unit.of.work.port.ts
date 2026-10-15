import { type Database } from '../shared/database.port.ts';
import { type AppliedOpRepository } from './applied.op.repository.port.ts';

/**
 * Transacao do hub (spec 022, T112): a gravacao da entidade e o registro da operacao aplicada
 * entram no MESMO commit - ou os dois, ou nenhum (FR-011).
 */
export interface SyncHubUnitOfWork {
  run<T>(work: (tx: Database, appliedOps: AppliedOpRepository) => Promise<T>): Promise<T>;
}
