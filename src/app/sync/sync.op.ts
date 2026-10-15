import { type BackupRecord } from '../shared/backup.record.schema.ts';
import { type SyncEntity } from './sync.entity.ts';

/**
 * Uma alteracao feita no celular, a enviar ao hub (spec 022, contracts/sync-protocol.md). O
 * `opId` nasce na hora da alteracao e e o que torna o reenvio idempotente (FR-010).
 */
export interface SyncOp {
  readonly opId: string;
  readonly entity: SyncEntity;
  readonly entityId: string;
  readonly kind: 'upsert' | 'delete';
  /** Versao do hub que o celular viu antes de alterar; `null` = criacao. */
  readonly baseVersion: string | null;
  /** Record do backup (upsert); `null` no delete. */
  readonly record: BackupRecord | null;
}
