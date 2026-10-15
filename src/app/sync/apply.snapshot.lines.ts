import { SYNC_CODECS } from './sync.record.codec.ts';
import { isLocalOnlySyncEntity } from './is.local.only.sync.entity.ts';
import { type SyncReplica } from './sync.replica.port.ts';
import { type SnapshotLine } from './stream.sync.snapshot.use.case.ts';

/**
 * Grava o snapshot do hub no celular (spec 022, T120): sem voltar ao outbox, com a versao-base de
 * cada registro e o cursor final. Devolve quantos registros gravou.
 */
export async function applySnapshotLines(replica: SyncReplica, lines: readonly SnapshotLine[]): Promise<number> {
  let applied = 0;
  await replica.applyingPull(async (tx) => {
    for (const line of lines) {
      if (line.kind === 'cursor') {
        await tx.outbox.setCursor(line.seq);
        continue;
      }
      // spec 027 (FR-011): pre-registros/anexos do hub (versoes antigas) nao entram no celular
      if (isLocalOnlySyncEntity(line.entity)) continue;
      const codec = SYNC_CODECS[line.entity];
      await codec.save(tx.database, codec.fromRecord(line.record));
      if (line.version !== null) await tx.outbox.setBaseVersion(line.entity, line.entityId, line.version);
      applied += 1;
    }
  });
  return applied;
}
