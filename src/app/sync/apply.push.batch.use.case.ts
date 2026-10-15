import { z } from 'zod';
import { isLocalOnlySyncEntity } from './is.local.only.sync.entity.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { type AppliedOpRepository } from './applied.op.repository.port.ts';
import { type SyncHubUnitOfWork } from './sync.hub.unit.of.work.port.ts';
import { type SyncOp } from './sync.op.ts';
import { type SyncOpResult } from './sync.op.result.ts';
import { SYNC_CODECS } from './sync.record.codec.ts';
import { canonicalRecord } from './canonical.record.ts';
import { syncOpSchema } from './sync.protocol.schema.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  ops: z.array(syncOpSchema).max(200),
});

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown }).code;
  if (code === 'P2003') return 'MISSING_REFERENCE';
  return typeof code === 'string' ? code : 'INVALID_RECORD';
}

/**
 * Aplica no hub um lote de operacoes vindas do celular (spec 022, T112; contracts/sync-protocol.md
 * regras 1-5). Cada operacao, numa transacao propria junto do seu registro em `sync_applied_ops`:
 *
 * 1. `opId` ja aplicado -> devolve o resultado guardado (`duplicate`), sem reaplicar.
 * 2. versao-base diferente da atual e a atual nao veio deste aparelho -> `conflict` - a menos que
 *    o conteudo seja identico (M1), que conta como `duplicate`.
 * 3. senao grava pelo codec (entidade de dominio: invariantes valem) e registra a operacao.
 * 4. excluir o que ja nao existe -> `applied` (idempotente).
 * 5. referencia inexistente e outros erros -> `rejected` com o codigo.
 * 6. o mesmo `opId` em dois pedidos simultaneos (reenvio apos timeout): o segundo perde a corrida
 *    na chave de `sync_applied_ops` e devolve o resultado do primeiro, como na regra 1.
 */
export class ApplyPushBatchUseCase {
  private readonly unitOfWork: SyncHubUnitOfWork;
  private readonly clock: Clock;

  public constructor(unitOfWork: SyncHubUnitOfWork, clock: Clock) {
    this.unitOfWork = unitOfWork;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<SyncOpResult[]> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('aplicar sincronizacao', flat.fieldErrors, flat.formErrors);
    }
    const { userId, deviceId, ops } = parsed.data;
    const results: SyncOpResult[] = [];
    for (const op of ops) {
      try {
        results.push(await this.unitOfWork.run((tx, applied) => this.applyOne(tx, applied, userId, deviceId, op)));
      } catch (error) {
        // o mesmo opId chegou em dois pedidos ao mesmo tempo (reenvio depois de timeout): o outro
        // ja gravou - e o resultado dele que vale, nao uma recusa (FR-010: idempotente)
        const settled = await this.appliedMeanwhile(op.opId).catch(() => null);
        if (settled !== null) {
          results.push(settled);
          continue;
        }
        results.push({
          opId: op.opId,
          status: 'rejected',
          code: errorCode(error),
          message: error instanceof Error ? error.message : 'falha ao aplicar',
        });
      }
    }
    return results;
  }

  private async applyOne(
    tx: Database,
    applied: AppliedOpRepository,
    userId: string,
    deviceId: string,
    op: SyncOp,
  ): Promise<SyncOpResult> {
    const previous = await applied.find(op.opId);
    if (previous) {
      return previous.result.status === 'applied' ? { ...previous.result, status: 'duplicate' } : previous.result;
    }
    // spec 027 (FR-011): celular antigo ainda envia pre-registros/anexos - aceita sem gravar, para
    // drenar o outbox dele sem conflito
    if (isLocalOnlySyncEntity(op.entity)) {
      await applied.save({ opId: op.opId, deviceId, entity: op.entity, entityId: op.entityId, resultVersion: null, result: { opId: op.opId, status: 'applied', version: null }, appliedAt: this.clock.now() });
      return { opId: op.opId, status: 'applied', version: null };
    }
    const codec = SYNC_CODECS[op.entity];
    const current = await codec.find(tx, userId, op.entityId);
    const currentVersion = current === null ? null : codec.version(current);

    const remember = async (result: SyncOpResult, version: string | null): Promise<SyncOpResult> => {
      await applied.save({
        opId: op.opId,
        deviceId,
        entity: op.entity,
        entityId: op.entityId,
        resultVersion: version,
        result,
        appliedAt: this.clock.now(),
      });
      return result;
    };

    if (op.kind === 'delete') {
      if (current === null) return remember({ opId: op.opId, status: 'applied', version: null }, null);
      if (codec.remove === undefined) {
        return { opId: op.opId, status: 'rejected', code: 'UNSUPPORTED', message: `${op.entity} nao e excluivel` };
      }
      if (await this.isForeignChange(applied, deviceId, op, currentVersion)) {
        return { opId: op.opId, status: 'conflict', remote: { record: codec.toRecord(current), version: currentVersion } };
      }
      await codec.remove(tx, userId, op.entityId);
      return remember({ opId: op.opId, status: 'applied', version: null }, null);
    }

    const record = op.record;
    if (record === null || record.kind !== op.entity || !('id' in record) || record.id !== op.entityId || record.userId !== userId) {
      return { opId: op.opId, status: 'rejected', code: 'INVALID_RECORD', message: 'record nao confere com a operacao' };
    }
    if (current !== null && canonicalRecord(codec.toRecord(current)) === canonicalRecord(record)) {
      return remember({ opId: op.opId, status: 'duplicate', version: currentVersion }, currentVersion);
    }
    if (current === null && op.baseVersion !== null) {
      return { opId: op.opId, status: 'conflict', remote: { record: null, version: null } };
    }
    if (current !== null && (await this.isForeignChange(applied, deviceId, op, currentVersion))) {
      return { opId: op.opId, status: 'conflict', remote: { record: codec.toRecord(current), version: currentVersion } };
    }
    await codec.save(tx, codec.fromRecord(record));
    const stored = await codec.find(tx, userId, op.entityId);
    const version = stored === null ? null : codec.version(stored);
    return remember({ opId: op.opId, status: 'applied', version }, version);
  }

  /** Resultado de quem aplicou este `opId` enquanto esta tentativa falhava; `null` se ninguem. */
  private async appliedMeanwhile(opId: string): Promise<SyncOpResult | null> {
    const previous = await this.unitOfWork.run((_tx, applied) => applied.find(opId));
    if (previous === null) return null;
    return previous.result.status === 'applied' ? { ...previous.result, status: 'duplicate' } : previous.result;
  }

    /** A versao atual difere da base e nao foi este aparelho que a produziu? */
  private async isForeignChange(
    applied: AppliedOpRepository,
    deviceId: string,
    op: SyncOp,
    currentVersion: string | null,
  ): Promise<boolean> {
    if (currentVersion === null || op.baseVersion === currentVersion) return false;
    return !(await applied.producedBy(deviceId, op.entity, op.entityId, currentVersion));
  }
}
