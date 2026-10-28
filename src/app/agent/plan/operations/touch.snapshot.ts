import { type RecordSnapshot, type TouchedRecord } from '../../../../domain/plan/touched.record.ts';
import { type Database } from '../../../shared/database.port.ts';
import { SYNC_CODECS } from '../../../sync/sync.record.codec.ts';
import { type WatchRef } from './watch.ref.ts';

/** Le o registro e o serializa pelo codec do sync (o mesmo formato do backup); `null` se nao existe. */
export async function readSnapshot(db: Database, userId: string, ref: WatchRef): Promise<RecordSnapshot | null> {
  const codec = SYNC_CODECS[ref.entity];
  const found = await codec.find(db, userId, ref.id);
  return found === null ? null : (codec.toRecord(found) as unknown as RecordSnapshot);
}

/** Grava o snapshot de volta (ou remove o registro quando o snapshot e `null`). */
export async function restoreSnapshot(db: Database, userId: string, ref: WatchRef, snapshot: RecordSnapshot | null): Promise<void> {
  const codec = SYNC_CODECS[ref.entity];
  if (snapshot === null) {
    await codec.remove?.(db, userId, ref.id);
    return;
  }
  await codec.save(db, codec.fromRecord(snapshot as never));
}

/** Registros tocados: o estado de cada referencia antes e depois da aplicacao. */
export async function captureTouched(db: Database, userId: string, refs: readonly WatchRef[], before: ReadonlyMap<string, RecordSnapshot | null>, keyOf: (r: WatchRef) => string): Promise<TouchedRecord[]> {
  const touched: TouchedRecord[] = [];
  for (const ref of refs) {
    touched.push({ entity: ref.entity, id: ref.id, before: before.get(keyOf(ref)) ?? null, after: await readSnapshot(db, userId, ref) });
  }
  return touched;
}
