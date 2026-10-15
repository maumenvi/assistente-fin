import { type OutboxEntry } from './outbox.entry.ts';
import { type SyncConflict } from './sync.conflict.ts';
import { type SyncEntity } from './sync.entity.ts';
import { type DetachedChange } from './detached.change.ts';

/** Modo do aparelho: sozinho ou pareado com um hub (FR-001/FR-008). */
export type SyncMode = 'standalone' | 'paired';

/**
 * Estado local da sincronizacao no celular (spec 022, T117): outbox, versoes-base, conflitos e
 * cursor. As alteracoes entram no outbox sozinhas (triggers do SQLite); aqui so se le e confirma.
 */
export interface SyncOutbox {
  mode(): Promise<SyncMode>;
  setMode(mode: SyncMode): Promise<void>;

  /** As mais antigas primeiro. */
  pending(limit: number): Promise<OutboxEntry[]>;
  pendingCount(): Promise<number>;
  /** Ha alteracao local ainda nao confirmada deste registro? */
  hasPending(entity: SyncEntity, entityId: string): Promise<boolean>;
  /** Poe um registro no outbox a mao (dados locais enviados ao parear, conflito resolvido). */
  enqueue(entity: SyncEntity, entityId: string): Promise<void>;
  /** Marca como enviadas: dali em diante nao se juntam a alteracoes novas (o `opId` fica). */
  markAttempted(opIds: readonly string[]): Promise<void>;
  /** Tira do outbox (confirmadas pelo hub ou viradas conflito). */
  remove(opIds: readonly string[]): Promise<void>;

  baseVersion(entity: SyncEntity, entityId: string): Promise<string | null>;
  setBaseVersion(entity: SyncEntity, entityId: string, version: string | null): Promise<void>;

  cursor(): Promise<number>;
  setCursor(cursor: number): Promise<void>;
  lastSuccessAt(): Promise<Date | null>;
  setLastSuccessAt(at: Date): Promise<void>;
  lastError(): Promise<string | null>;
  setLastError(message: string | null): Promise<void>;
  /** O ultimo ciclo terminou sem achar o desktop, nem na busca (spec 024, FR-008). */
  hubUnreachable(): Promise<boolean>;
  setHubUnreachable(value: boolean): Promise<void>;
  /** Hora da ultima busca automatica do desktop na rede (spec 024: intervalo entre buscas). */
  lastDiscoveryAt(): Promise<Date | null>;
  setLastDiscoveryAt(at: Date): Promise<void>;

  saveConflict(conflict: SyncConflict): Promise<void>;
  listConflicts(): Promise<SyncConflict[]>;
  findConflict(id: string): Promise<SyncConflict | null>;
  hasConflict(entity: SyncEntity, entityId: string): Promise<boolean>;
  removeConflict(id: string): Promise<void>;

  /**
   * Guarda o que esta no outbox como "nao chegou ao desktop" antes de desparear (spec 024, US3):
   * no proximo pareamento com "enviar", vira conflito ou reenvio em vez de ser sobrescrito.
   */
  detachPending(at: Date): Promise<void>;
  listDetached(): Promise<DetachedChange[]>;
  clearDetached(): Promise<void>;

  /** Apaga outbox, versoes-base, conflitos e cursor e volta ao modo `standalone` (FR-008a). */
  reset(): Promise<void>;
}
