import { LOCAL_ONLY_SYNC_ENTITIES } from './local.only.sync.entities.ts';
import { type SyncEntity } from './sync.entity.ts';

/** `true` para entidades que ficam so no celular e nunca entram na sincronizacao (spec 027, FR-011). */
export function isLocalOnlySyncEntity(entity: SyncEntity | string): boolean {
  return (LOCAL_ONLY_SYNC_ENTITIES as readonly string[]).includes(entity);
}
