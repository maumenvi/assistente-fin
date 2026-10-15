import { type Database } from '../shared/database.port.ts';
import { type SyncEntity } from './sync.entity.ts';
import { type SyncOutbox } from './sync.outbox.port.ts';

/**
 * O banco local do celular visto pela sincronizacao (spec 022, T117/T118): o `Database` do app +
 * o estado da sync, na MESMA transacao quando preciso.
 */
export interface SyncReplica {
  readonly database: Database;
  readonly outbox: SyncOutbox;
  transaction<T>(work: (tx: SyncReplica) => Promise<T>): Promise<T>;
  /**
   * Roda `work` numa transacao em que as escritas NAO voltam para o outbox (vieram do hub).
   */
  applyingPull<T>(work: (tx: SyncReplica) => Promise<T>): Promise<T>;
  /** Descarta todos os dados do usuario no aparelho (pareamento escolhendo "descartar"). */
  wipeUserData(): Promise<void>;
  /** Troca o dono de todos os registros locais (o celular vira o usuario do hub). */
  rekeyUser(fromUserId: string, toUserId: string): Promise<void>;
  /** Troca um id por outro em todas as referencias locais (fusao de categoria de mesmo nome). */
  replaceReference(oldId: string, newId: string): Promise<void>;
  /** Exclusao vinda do hub: apaga a linha direto, mesmo de entidade que o app nao exclui. */
  forceDelete(entity: SyncEntity, entityId: string): Promise<void>;
}
