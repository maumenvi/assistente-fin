import { type SyncEntity } from './sync.entity.ts';

/** Alteracao que nao chegou ao desktop antes do despareamento (spec 024, US3; `sync_detached`). */
export interface DetachedChange {
  readonly entity: SyncEntity;
  readonly entityId: string;
  readonly detachedAt: Date;
}
