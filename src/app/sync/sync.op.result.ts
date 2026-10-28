import { type BackupRecord } from '../shared/backup.record.schema.ts';

/** Resultado de uma operacao no hub (spec 022, contracts/sync-protocol.md, push). */
export type SyncOpResult =
  | { readonly opId: string; readonly status: 'applied' | 'duplicate'; readonly version: string | null }
  | { readonly opId: string; readonly status: 'conflict'; readonly remote: { readonly record: BackupRecord | null; readonly version: string | null } }
  | { readonly opId: string; readonly status: 'rejected'; readonly code: string; readonly message: string }
  /**
   * So entidades "ultima escrita vence" (spec 032): a versao do celular perdeu; `remote` e a que
   * valeu (`record: null` = o hub excluiu). O celular a aplica na hora, sem abrir conflito.
   */
  | { readonly opId: string; readonly status: 'superseded'; readonly remote: { readonly record: BackupRecord | null; readonly version: string | null } };
