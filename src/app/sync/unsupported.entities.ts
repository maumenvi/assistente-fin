import { type SyncEntity } from './sync.entity.ts';
import { type SyncHello } from './sync.transport.port.ts';

/** Primeira versao do formato de backup do hub que entende cada entidade nova do sync. */
const MIN_BACKUP_SCHEMA: Partial<Record<SyncEntity, number>> = { preference: 4, categorizationRule: 5 };

/**
 * Entidades que o hub ainda nao entende (spec 032, research P1): o celular nao as envia, e elas
 * ficam no outbox ate o desktop atualizar. `hello` sem `backupSchemaVersion` conta como hub antigo.
 */
export function unsupportedEntities(hello: SyncHello): SyncEntity[] {
  const version = hello.backupSchemaVersion ?? 0;
  return (Object.entries(MIN_BACKUP_SCHEMA) as [SyncEntity, number][]).filter(([, min]) => version < min).map(([entity]) => entity);
}
