import { LAST_WRITE_WINS_SYNC_ENTITIES } from './last.write.wins.sync.entities.ts';
import { type SyncEntity } from './sync.entity.ts';

/** `true` para entidades resolvidas por "ultima escrita vence" (spec 032). */
export function isLastWriteWinsSyncEntity(entity: SyncEntity | string): boolean {
  return (LAST_WRITE_WINS_SYNC_ENTITIES as readonly string[]).includes(entity);
}
