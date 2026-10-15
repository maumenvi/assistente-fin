import { type SyncEntity } from './sync.entity.ts';

/** Uma alteracao local ainda nao confirmada pelo hub (spec 022, T117). */
export interface OutboxEntry {
  readonly seq: number;
  readonly opId: string;
  readonly entity: SyncEntity;
  readonly entityId: string;
  /** Quantas vezes ja foi enviada sem confirmacao. */
  readonly attempts: number;
}
