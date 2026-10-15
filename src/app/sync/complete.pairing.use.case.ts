import { CategoryName } from '../../domain/category/category.name.value.object.ts';
import { isLocalOnlySyncEntity } from './is.local.only.sync.entity.ts';
import { applySnapshotLines } from './apply.snapshot.lines.ts';
import { userFromPairedProfile, type PairedUserProfile } from './paired.user.profile.ts';
import { SYNC_CODECS } from './sync.record.codec.ts';
import { SYNC_ENTITIES, type SyncEntity } from './sync.entity.ts';
import { type SyncReplica } from './sync.replica.port.ts';
import { type SnapshotLine } from './stream.sync.snapshot.use.case.ts';
import { type BackupRecord } from '../shared/backup.record.schema.ts';
import { type Clock } from '../shared/clock.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';

/** O que fazer com o que ja existe no celular ao parear (spec 022, T120). */
export type LocalDataChoice = 'send' | 'discard';

export interface CompletePairingInput {
  /** Usuario local de antes do pareamento (`null` = celular novo). */
  readonly localUserId: string | null;
  readonly user: PairedUserProfile;
  readonly snapshot: readonly SnapshotLine[];
  readonly localData: LocalDataChoice;
}

export interface CompletePairingResult {
  /** Registros do desktop gravados no celular. */
  readonly received: number;
  /** Registros do celular postos na fila para o desktop. */
  readonly queued: number;
}

/**
 * Fecha o pareamento no celular (spec 022, T120; FR-008), numa transacao so:
 *
 * - `discard`: apaga os dados locais e fica so com os do desktop.
 * - `send`: o celular vira o usuario do hub (mesmo id), recebe o snapshot e poe na fila tudo o
 *   que so ele tinha. Categoria com o mesmo nome de uma do desktop e fundida na do desktop (as
 *   referencias passam a apontar para ela) - o banco principal nao aceita nome repetido.
 *
 * Termina no modo `paired`: dali em diante toda escrita local entra no outbox.
 *
 * Spec 024 (FR-013): o que nao chegou ao desktop antes de um despareamento (`sync_detached`) e que
 * o desktop tambem tem NAO e sobrescrito em silencio pelo snapshot - vira conflito (versao do
 * celular x do desktop) para o usuario escolher. Os que o desktop nao tem entram no outbox como
 * qualquer registro local.
 */
export class CompletePairingUseCase {
  private readonly replica: SyncReplica;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  public constructor(replica: SyncReplica, ids: IdGenerator, clock: Clock) {
    this.replica = replica;
    this.ids = ids;
    this.clock = clock;
  }

  public execute(input: CompletePairingInput): Promise<CompletePairingResult> {
    return this.replica.transaction(async (tx) => {
      const hubUserId = input.user.id;
      await tx.outbox.reset();
      const keepLocal = input.localData === 'send' && input.localUserId !== null;
      if (keepLocal) {
        await tx.rekeyUser(input.localUserId!, hubUserId);
      } else {
        await tx.wipeUserData();
      }
      const existing = await tx.database.users.findById(hubUserId);
      await tx.database.users.save(userFromPairedProfile(input.user).withUpdatedAt(existing?.updatedAt ?? null));

      const fromHub = new Set(
        input.snapshot.flatMap((line) => (line.kind === 'row' ? [`${line.entity}:${line.entityId}`] : [])),
      );
      // versao do celular do que nao chegou ao desktop, ANTES de o snapshot escrever por cima
      const unsent = keepLocal ? await this.captureDetached(tx, hubUserId, fromHub) : [];
      await tx.outbox.clearDetached();
      const received = await applySnapshotLines(tx, input.snapshot);
      for (const local of unsent) {
        const remote = input.snapshot.find((line) => line.kind === 'row' && line.entity === local.entity && line.entityId === local.entityId);
        if (remote === undefined || remote.kind !== 'row') continue;
        await tx.outbox.saveConflict({
          id: this.ids.next(),
          entity: local.entity,
          entityId: local.entityId,
          localRecord: local.record,
          remoteRecord: remote.record,
          remoteVersion: remote.version,
          reason: null,
          detectedAt: this.clock.now(),
        });
      }
      if (keepLocal) await this.mergeCategoriesByName(tx, hubUserId, fromHub);

      await tx.outbox.setMode('paired');
      let queued = 0;
      if (keepLocal) {
        for (const entity of SYNC_ENTITIES) {
          if (isLocalOnlySyncEntity(entity)) continue; // spec 027 (FR-011): ficam no celular
          for (const item of await SYNC_CODECS[entity].list(tx.database, hubUserId)) {
            const id = (item as { id: string }).id;
            if (fromHub.has(`${entity}:${id}`)) continue;
            await tx.outbox.enqueue(entity, id);
            queued += 1;
          }
        }
      }
      return { received, queued };
    });
  }

  /** Registros locais (ou `null` = excluido aqui) do que nao chegou ao desktop e que ele tambem tem. */
  private async captureDetached(
    tx: SyncReplica,
    userId: string,
    fromHub: ReadonlySet<string>,
  ): Promise<{ entity: SyncEntity; entityId: string; record: BackupRecord | null }[]> {
    const captured: { entity: SyncEntity; entityId: string; record: BackupRecord | null }[] = [];
    for (const detached of await tx.outbox.listDetached()) {
      if (!fromHub.has(`${detached.entity}:${detached.entityId}`) || isLocalOnlySyncEntity(detached.entity)) continue;
      const codec = SYNC_CODECS[detached.entity];
      const current = await codec.find(tx.database, userId, detached.entityId);
      captured.push({ entity: detached.entity, entityId: detached.entityId, record: current === null ? null : codec.toRecord(current) });
    }
    return captured;
  }

  private async mergeCategoriesByName(tx: SyncReplica, userId: string, fromHub: ReadonlySet<string>): Promise<void> {
    const categories = await tx.database.categories.listByUser(userId);
    const hubByName = new Map(
      categories.filter((c) => fromHub.has(`category:${c.id}`)).map((c) => [CategoryName.normalize(c.name.value), c.id]),
    );
    for (const local of categories) {
      if (fromHub.has(`category:${local.id}`)) continue;
      const target = hubByName.get(CategoryName.normalize(local.name.value));
      if (target === undefined) continue;
      await tx.forceDelete('category', local.id);
      await tx.replaceReference(local.id, target);
    }
  }
}
