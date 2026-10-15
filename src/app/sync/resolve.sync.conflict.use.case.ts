import { z } from 'zod';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { SYNC_CODECS } from './sync.record.codec.ts';
import { type SyncReplica } from './sync.replica.port.ts';
import { SyncConflictNotFoundError } from './sync.conflict.not.found.error.ts';

const inputSchema = z.object({
  conflictId: z.string().trim().min(1),
  keep: z.enum(['local', 'remote']),
});

/**
 * Resolve um conflito de sincronizacao pela escolha do usuario (spec 022, T121; FR-012):
 *
 * - `remote`: grava no celular a versao do desktop (ou apaga, se o desktop excluiu), sem voltar ao
 *   outbox.
 * - `local`: marca a versao do desktop como vista e poe o registro do celular de novo na fila - o
 *   proximo envio passa por cima (ou exclui) conscientemente.
 *
 * Operacao RECUSADA pelo hub (`reason`): `local` reenvia; `remote` desfaz a alteracao no celular.
 */
export class ResolveSyncConflictUseCase {
  private readonly replica: SyncReplica;

  public constructor(replica: SyncReplica) {
    this.replica = replica;
  }

  public async execute(raw: unknown): Promise<void> {
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('resolver conflito', flat.fieldErrors, flat.formErrors);
    }
    const { conflictId, keep } = parsed.data;
    const conflict = await this.replica.outbox.findConflict(conflictId);
    if (conflict === null) throw new SyncConflictNotFoundError();

    if (keep === 'remote' && conflict.reason !== null) {
      await this.replica.applyingPull(async (tx) => {
        const known = await tx.outbox.baseVersion(conflict.entity, conflict.entityId);
        if (known === null) {
          // nunca chegou ao desktop: desfazer = apagar aqui
          await tx.forceDelete(conflict.entity, conflict.entityId);
        } else {
          // o desktop tem uma versao que o celular nao guarda: esquece a base e repassa o log
          // desde o inicio - o proximo pull traz a versao do desktop (os demais sao ignorados
          // pela versao igual)
          await tx.outbox.setBaseVersion(conflict.entity, conflict.entityId, null);
          await tx.outbox.setCursor(0);
        }
        await tx.outbox.removeConflict(conflict.id);
      });
      return;
    }
    if (keep === 'remote') {
      await this.replica.applyingPull(async (tx) => {
        if (conflict.remoteRecord === null) {
          await tx.forceDelete(conflict.entity, conflict.entityId);
        } else {
          const codec = SYNC_CODECS[conflict.entity];
          await codec.save(tx.database, codec.fromRecord(conflict.remoteRecord));
        }
        await tx.outbox.setBaseVersion(conflict.entity, conflict.entityId, conflict.remoteVersion);
        await tx.outbox.removeConflict(conflict.id);
      });
      return;
    }
    await this.replica.transaction(async (tx) => {
      await tx.outbox.setBaseVersion(conflict.entity, conflict.entityId, conflict.remoteVersion);
      await tx.outbox.enqueue(conflict.entity, conflict.entityId);
      await tx.outbox.removeConflict(conflict.id);
    });
  }
}
