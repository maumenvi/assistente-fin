import { type SyncOp } from './sync.op.ts';
import { type SyncOpResult } from './sync.op.result.ts';
import { type ChangesPage } from './list.changes.use.case.ts';
import { type SnapshotLine } from './stream.sync.snapshot.use.case.ts';

/** Resposta do `hello` (contracts/sync-protocol.md). */
export interface SyncHello {
  readonly protocolVersion: number;
  readonly hubId: string;
  readonly serverTime: string;
  /**
   * Versao do formato de backup do hub (spec 032): o celular so envia `preference` se for >= 4.
   * Ausente = hub antigo.
   */
  readonly backupSchemaVersion?: number;
}

/**
 * Como o celular fala com o hub (spec 022, T118): no app, HTTP cifrado na rede local (T119); nos
 * testes, direto nos casos de uso do hub, com falhas injetadas.
 */
export interface SyncTransport {
  hello(): Promise<SyncHello>;
  push(ops: readonly SyncOp[]): Promise<SyncOpResult[]>;
  changes(since: number, limit: number): Promise<ChangesPage>;
  snapshot(): Promise<SnapshotLine[]>;
}
