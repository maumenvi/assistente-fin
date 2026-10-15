import { type BackupRecord } from '../shared/backup.record.schema.ts';
import { type SyncEntity } from './sync.entity.ts';

/**
 * Registro alterado dos dois lados (spec 022, FR-011): fica parado ate o usuario escolher entre
 * manter o do celular ou o do desktop. `null` = o registro foi excluido naquele lado.
 */
export interface SyncConflict {
  readonly id: string;
  readonly entity: SyncEntity;
  readonly entityId: string;
  readonly localRecord: BackupRecord | null;
  readonly remoteRecord: BackupRecord | null;
  readonly remoteVersion: string | null;
  /** Preenchido quando o hub RECUSOU a operacao (ex.: referencia inexistente) em vez de conflito. */
  readonly reason: string | null;
  readonly detectedAt: Date;
}
