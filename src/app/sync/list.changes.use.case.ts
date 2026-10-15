import { z } from 'zod';
import { isLocalOnlySyncEntity } from './is.local.only.sync.entity.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Database } from '../shared/database.port.ts';
import { SYNC_ENTITIES, type SyncEntity } from './sync.entity.ts';
import { SYNC_CODECS } from './sync.record.codec.ts';
import { type SyncChangeRepository } from './sync.change.repository.port.ts';
import { type SyncChange } from './sync.change.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1),
  since: z.int().min(0),
  limit: z.int().min(1).max(1000),
});

/** Resposta do pull (contracts/sync-protocol.md, `changes`). */
export interface ChangesPage {
  readonly changes: readonly SyncChange[];
  readonly nextSince: number;
  readonly hasMore: boolean;
}

/**
 * Pull de alteracoes do hub (spec 022, T113): as linhas do log depois de `since`, colapsadas por
 * registro, com o ESTADO ATUAL de cada uma (record + versao, ou exclusao). Entidades fora da
 * sincronizacao sao ignoradas.
 */
export class ListChangesUseCase {
  private readonly database: Database;
  private readonly changes: SyncChangeRepository;

  public constructor(database: Database, changes: SyncChangeRepository) {
    this.database = database;
    this.changes = changes;
  }

  public async execute(rawInput: unknown): Promise<ChangesPage> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar alteracoes', flat.fieldErrors, flat.formErrors);
    }
    const { userId, since, limit } = parsed.data;
    const rows = await this.changes.listSince(userId, since, limit + 1);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    const latest = new Map<string, { seq: number; entity: SyncEntity; entityId: string }>();
    for (const row of page) {
      if (!SYNC_ENTITIES.includes(row.entity as SyncEntity) || isLocalOnlySyncEntity(row.entity)) continue;
      latest.set(`${row.entity}:${row.entityId}`, { seq: row.seq, entity: row.entity as SyncEntity, entityId: row.entityId });
    }
    const changes: SyncChange[] = [];
    for (const item of [...latest.values()].sort((a, b) => a.seq - b.seq)) {
      const codec = SYNC_CODECS[item.entity];
      const current = await codec.find(this.database, userId, item.entityId);
      changes.push(
        current === null
          ? { seq: item.seq, entity: item.entity, entityId: item.entityId, kind: 'delete', version: null, record: null }
          : {
              seq: item.seq,
              entity: item.entity,
              entityId: item.entityId,
              kind: 'upsert',
              version: codec.version(current),
              record: codec.toRecord(current),
            },
      );
    }
    return { changes, nextSince: page.at(-1)?.seq ?? since, hasMore };
  }
}
