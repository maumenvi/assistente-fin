import { type Clock } from '../shared/clock.port.ts';
import { isLocalOnlySyncEntity } from './is.local.only.sync.entity.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type OutboxEntry } from './outbox.entry.ts';
import { SYNC_CODECS } from './sync.record.codec.ts';
import { type SyncOp } from './sync.op.ts';
import { type SyncOpResult } from './sync.op.result.ts';
import { SYNC_PROTOCOL_VERSION } from './sync.protocol.schema.ts';
import { type SyncReplica } from './sync.replica.port.ts';
import { type SyncTransport } from './sync.transport.port.ts';
import { type SyncCycleReport } from './sync.cycle.report.ts';
import { type SyncChange } from './sync.change.ts';
import { SyncProtocolError } from './sync.protocol.error.ts';
import { reconcilePreferences } from '../agent/preference/reconcile.preferences.ts';
import { makePreferenceOverwrite } from './make.preference.overwrite.ts';
import { type BackupRecord } from '../shared/backup.record.schema.ts';
import { type SyncEntity } from './sync.entity.ts';
import { unsupportedEntities } from './unsupported.entities.ts';

const PUSH_BATCH = 200;
const PULL_PAGE = 500;
/** O pull recomeca um pouco antes do cursor: `seq` de transacoes que ainda nao tinham commitado. */
const PULL_OVERLAP = 500;
/** Trava de seguranca contra laco sem progresso. */
const MAX_ROUNDS = 1000;

/**
 * Motor de sincronizacao do celular (spec 022, T118; contracts/sync-protocol.md).
 *
 * Um ciclo: `hello` -> envia o outbox em lotes de 200 -> puxa as alteracoes desde
 * `cursor - 500`, gravando o cursor na mesma transacao do que aplicou. Nunca roda dois ciclos
 * ao mesmo tempo (quem pedir durante um ciclo recebe o mesmo). Idempotente: o `opId` so sai do
 * outbox quando o hub confirma, e o hub reconhece o reenvio.
 */
export class SyncEngine {
  private readonly replica: SyncReplica;
  private readonly transport: SyncTransport;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private running: Promise<SyncCycleReport> | null = null;

  public constructor(replica: SyncReplica, transport: SyncTransport, clock: Clock, ids: IdGenerator) {
    this.replica = replica;
    this.transport = transport;
    this.clock = clock;
    this.ids = ids;
  }

  public get busy(): boolean {
    return this.running !== null;
  }

  public sync(userId: string): Promise<SyncCycleReport> {
    this.running ??= this.cycle(userId).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async cycle(userId: string): Promise<SyncCycleReport> {
    const outbox = this.replica.outbox;
    if ((await outbox.mode()) !== 'paired') return { pushed: 0, conflicts: 0, rejected: [], pulled: 0 };
    try {
      const hello = await this.transport.hello();
      if (hello.protocolVersion !== SYNC_PROTOCOL_VERSION) throw new SyncProtocolError(hello.protocolVersion);
      const pushed = await this.pushAll(userId, unsupportedEntities(hello));
      const pulled = await this.pullAll(userId);
      await reconcilePreferences(this.replica.database.preferences, userId, this.clock.now());
      await outbox.setLastSuccessAt(this.clock.now());
      await outbox.setLastError(null);
      return { ...pushed, pulled };
    } catch (error) {
      await outbox.setLastError(error instanceof Error ? error.message : 'falha na sincronizacao');
      throw error;
    }
  }

  private async pushAll(userId: string, exclude: readonly SyncEntity[]): Promise<Omit<SyncCycleReport, 'pulled'>> {
    const outbox = this.replica.outbox;
    let pushed = 0;
    let conflicts = 0;
    const rejected: { entity: string; entityId: string; message: string }[] = [];
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const entries = await outbox.pending(PUSH_BATCH, exclude);
      if (entries.length === 0) break;
      const ops = await this.buildOps(userId, entries);
      await outbox.markAttempted(entries.map((entry) => entry.opId));
      const results = await this.transport.push(ops);
      const byOp = new Map(results.map((result) => [result.opId, result]));
      await this.replica.transaction(async (tx) => {
        for (const op of ops) {
          const result = byOp.get(op.opId);
          if (result === undefined) continue;
          const outcome = await this.settle(tx, op, result);
          if (outcome === 'pushed') pushed += 1;
          else if (outcome === 'conflict') conflicts += 1;
          else rejected.push({ entity: op.entity, entityId: op.entityId, message: outcome.message });
        }
      });
      if (results.length === 0) break;
    }
    return { pushed, conflicts, rejected };
  }

  private async buildOps(userId: string, entries: readonly OutboxEntry[]): Promise<SyncOp[]> {
    const ops: SyncOp[] = [];
    for (const entry of entries) {
      const codec = SYNC_CODECS[entry.entity];
      const current = await codec.find(this.replica.database, userId, entry.entityId);
      ops.push({
        opId: entry.opId,
        entity: entry.entity,
        entityId: entry.entityId,
        kind: current === null ? 'delete' : 'upsert',
        baseVersion: await this.replica.outbox.baseVersion(entry.entity, entry.entityId),
        record: current === null ? null : codec.toRecord(current),
      });
    }
    return ops;
  }

  private async settle(tx: SyncReplica, op: SyncOp, result: SyncOpResult): Promise<'pushed' | 'conflict' | { message: string }> {
    await tx.outbox.remove([op.opId]);
    if (result.status === 'rejected') {
      // recusada nao some: vira pendencia com o motivo, e o usuario reenvia ou desiste
      await tx.outbox.saveConflict({
        id: this.ids.next(),
        entity: op.entity,
        entityId: op.entityId,
        localRecord: op.record,
        remoteRecord: null,
        remoteVersion: null,
        reason: result.message,
        detectedAt: this.clock.now(),
      });
      return { message: result.message };
    }
    if (result.status === 'superseded') {
      await this.applySuperseded(tx, op, result.remote);
      return 'pushed';
    }
    if (result.status === 'conflict') {
      await tx.outbox.saveConflict({
        id: this.ids.next(),
        entity: op.entity,
        entityId: op.entityId,
        localRecord: op.record,
        remoteRecord: result.remote.record,
        remoteVersion: result.remote.version,
        reason: null,
        detectedAt: this.clock.now(),
      });
      return 'conflict';
    }
    await tx.outbox.setBaseVersion(op.entity, op.entityId, result.version);
    return 'pushed';
  }

  /**
   * "Ultima escrita vence" (spec 032): a versao do celular perdeu. Aplica a que valeu ja, sem
   * esperar o pull (o cursor pode ja ter passado dela), e guarda o texto perdido para o aviso.
   */
  private async applySuperseded(tx: SyncReplica, op: SyncOp, remote: { readonly record: BackupRecord | null; readonly version: string | null }): Promise<void> {
    const codec = SYNC_CODECS[op.entity];
    await tx.applyingPull(async (inner) => {
      if (remote.record === null) {
        await inner.forceDelete(op.entity, op.entityId);
        await inner.outbox.setBaseVersion(op.entity, op.entityId, null);
      } else {
        await codec.save(inner.database, codec.fromRecord(remote.record));
        await inner.outbox.setBaseVersion(op.entity, op.entityId, remote.version);
      }
      if (op.record?.kind === 'preference') {
        const keptText = remote.record?.kind === 'preference' ? remote.record.text : null;
        const overwrite = makePreferenceOverwrite({ userId: op.record.userId, preferenceId: op.record.id, lostText: op.record.text, lostAt: op.record.updatedAt, keptText });
        if (overwrite !== null) await inner.database.preferences.overwrites.record(overwrite);
      }
    });
  }

  private async pullAll(userId: string): Promise<number> {
    let pulled = 0;
    let since = Math.max(0, (await this.replica.outbox.cursor()) - PULL_OVERLAP);
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const page = await this.transport.changes(since, PULL_PAGE);
      await this.replica.applyingPull(async (tx) => {
        for (const change of page.changes) {
          if (await this.applyChange(tx, userId, change)) pulled += 1;
        }
        await tx.outbox.setCursor(Math.max(await tx.outbox.cursor(), page.nextSince));
      });
      if (!page.hasMore || page.nextSince <= since) break;
      since = page.nextSince;
    }
    return pulled;
  }

  /** Aplica uma alteracao do hub; `false` = nao precisou ou esta segurada por alteracao local. */
  private async applyChange(tx: SyncReplica, userId: string, change: SyncChange): Promise<boolean> {
    // spec 027 (FR-011): pre-registros/anexos ficam no celular - nada do hub os cria ou apaga
    if (isLocalOnlySyncEntity(change.entity)) return false;
    const outbox = tx.outbox;
    if (await outbox.hasPending(change.entity, change.entityId)) return false;
    if (await outbox.hasConflict(change.entity, change.entityId)) return false;
    const known = await outbox.baseVersion(change.entity, change.entityId);
    if (change.kind === 'delete' || change.record === null) {
      const codec = SYNC_CODECS[change.entity];
      if ((await codec.find(tx.database, userId, change.entityId)) === null && known === null) return false;
      await tx.forceDelete(change.entity, change.entityId);
      await outbox.setBaseVersion(change.entity, change.entityId, null);
      return true;
    }
    if (change.version !== null && change.version === known) return false;
    const codec = SYNC_CODECS[change.entity];
    await codec.save(tx.database, codec.fromRecord(change.record));
    await outbox.setBaseVersion(change.entity, change.entityId, change.version);
    return true;
  }
}
