/** Uma linha do log de alteracoes do hub (tabela `sync_changes`, alimentada por triggers). */
export interface SyncChangeRow {
  readonly seq: number;
  readonly entity: string;
  readonly entityId: string;
  readonly kind: 'upsert' | 'delete';
}

/** Porta do log de alteracoes do hub (spec 022, T109). */
export interface SyncChangeRepository {
  /** Linhas do usuario com `seq > since`, em ordem, no maximo `limit`. */
  listSince(userId: string, since: number, limit: number): Promise<SyncChangeRow[]>;
  /** Maior `seq` do usuario (0 se nenhuma). */
  maxSeq(userId: string): Promise<number>;
}
