import { type BackupRecord } from '../shared/backup.record.schema.ts';
import { type SyncEntity } from './sync.entity.ts';

/** Estado atual de uma linha alterada, como o pull entrega ao celular (spec 022). */
export interface SyncChange {
  readonly seq: number;
  readonly entity: SyncEntity;
  readonly entityId: string;
  readonly kind: 'upsert' | 'delete';
  readonly version: string | null;
  readonly record: BackupRecord | null;
}
