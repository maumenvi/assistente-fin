import { type Database } from '../shared/database.port.ts';
import { type SyncHubUnitOfWork } from './sync.hub.unit.of.work.port.ts';
import { type SyncChangeRepository } from './sync.change.repository.port.ts';
import { type PairedDeviceRepository } from './paired.device.repository.port.ts';

/** O que o banco do hub oferece para a sincronizacao (spec 022). */
export interface SyncHubPorts {
  readonly database: Database;
  readonly unitOfWork: SyncHubUnitOfWork;
  readonly changes: SyncChangeRepository;
  readonly devices: PairedDeviceRepository;
}
