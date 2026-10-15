import { type Database } from '../shared/database.port.ts';
import { isLocalOnlySyncEntity } from './is.local.only.sync.entity.ts';
import { type BackupRecord } from '../shared/backup.record.schema.ts';
import { SYNC_ENTITIES, type SyncEntity } from './sync.entity.ts';
import { SYNC_CODECS } from './sync.record.codec.ts';
import { type SyncChangeRepository } from './sync.change.repository.port.ts';

/** Uma linha do snapshot inicial do pareamento. */
export type SnapshotLine =
  | { readonly kind: 'row'; readonly entity: SyncEntity; readonly entityId: string; readonly version: string | null; readonly record: BackupRecord }
  | { readonly kind: 'cursor'; readonly seq: number };

/**
 * Snapshot inicial do pareamento (spec 022, T113; contracts/sync-protocol.md): todos os registros
 * sincronizaveis do usuario, pais antes dos filhos, e no fim o cursor. O cursor e lido ANTES da
 * leitura - o que mudar durante o snapshot volta no primeiro pull (a sobreposicao e segura).
 */
export async function* streamSyncSnapshot(
  database: Database,
  changes: SyncChangeRepository,
  userId: string,
): AsyncGenerator<SnapshotLine> {
  const cursor = await changes.maxSeq(userId);
  for (const entity of SYNC_ENTITIES) {
    if (isLocalOnlySyncEntity(entity)) continue; // spec 027 (FR-011): ficam no celular
    const codec = SYNC_CODECS[entity];
    for (const item of await codec.list(database, userId)) {
      const record = codec.toRecord(item);
      yield { kind: 'row', entity, entityId: 'id' in record ? String(record.id) : '', version: codec.version(item), record };
    }
  }
  yield { kind: 'cursor', seq: cursor };
}
