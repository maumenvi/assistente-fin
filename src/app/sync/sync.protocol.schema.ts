import { z } from 'zod';
import { backupRecordSchema } from '../shared/backup.record.schema.ts';
import { SYNC_ENTITIES } from './sync.entity.ts';

/** Versao do protocolo de sincronizacao (spec 022, contracts/sync-protocol.md). */
export const SYNC_PROTOCOL_VERSION = 1;

/** Uma operacao do push, validada na fronteira. */
export const syncOpSchema = z.object({
  opId: z.string().trim().min(1).max(100),
  entity: z.enum(SYNC_ENTITIES),
  entityId: z.string().trim().min(1).max(200),
  kind: z.enum(['upsert', 'delete']),
  baseVersion: z.string().min(1).max(100).nullable(),
  record: backupRecordSchema.nullable(),
});

/** Corpo do push: ate 200 operacoes por lote. */
export const pushRequestSchema = z.object({ ops: z.array(syncOpSchema).max(200) });

/** Parametros do pull de alteracoes. */
export const changesQuerySchema = z.object({
  since: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
