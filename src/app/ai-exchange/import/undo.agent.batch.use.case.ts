import { z } from 'zod';
import { type Database } from '../../shared/database.port.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AiBatch } from '../ai.batch.ts';
import { type AiBatchOp } from '../ai.batch.op.ts';
import { type AiBatchStore } from '../ai.batch.store.port.ts';
import { AiBatchNotFoundError } from '../errors/ai.batch.not.found.error.ts';
import { AiBatchStateError } from '../errors/ai.batch.state.error.ts';
import { detectUndoConflicts } from './journal/detect.undo.conflict.ts';
import { journalItemKey } from './journal/journal.item.id.ts';
import { deleteJournalItems, restoreJournalItems } from './journal/restore.journal.items.ts';
import { summarizeOps } from './batch.summary.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  batchId: z.string().trim().min(1, 'batchId obrigatorio'),
  /** Desfaz mesmo os itens que mudaram depois do lote (so depois de o usuario ver o aviso). */
  force: z.boolean().default(false),
});

export interface UndoAgentBatchResult {
  readonly batch: AiBatch;
  readonly ops: readonly AiBatchOp[];
  /** Ids dos itens que mudaram depois do lote e por isso ficaram como estao (a menos que `force`). */
  readonly conflicts: readonly string[];
}

/**
 * Desfaz o lote inteiro (spec 029, FR-007, SC-006, R4): percorre as operacoes aplicadas de tras para
 * a frente; criacoes viram exclusao, ajustes e apagados voltam a imagem anterior, inclusive todas as
 * parcelas de uma compra parcelada. Item alterado depois do lote vira `undo_conflict` e e pulado; o
 * resto e desfeito. As escritas do desfazer entram no outbox como qualquer escrita local (FR-008).
 * Categorias nao se apagam na v1, entao uma categoria criada pelo lote permanece.
 */
export class UndoAgentBatchUseCase {
  private readonly database: Database;
  private readonly store: AiBatchStore;
  private readonly clock: Clock;

  public constructor(database: Database, store: AiBatchStore, clock: Clock) {
    this.database = database;
    this.store = store;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<UndoAgentBatchResult> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('desfazer lote da IA', flat.fieldErrors, flat.formErrors);
    }
    const { userId, batchId, force } = parsed.data;
    const batch = await this.store.findBatch(userId, batchId);
    if (batch === null) throw new AiBatchNotFoundError();
    if (batch.status !== 'applied' && batch.status !== 'partially_applied') throw new AiBatchStateError('este lote nao pode ser desfeito');

    const ops = await this.store.listOps(batchId);
    const updated: AiBatchOp[] = [...ops];
    const conflicts: string[] = [];

    await this.database.transaction(async (transaction) => {
      for (let index = ops.length - 1; index >= 0; index -= 1) {
        const op = ops[index]!;
        // quem ficou em conflito na rodada anterior pode ser desfeito agora (com `force`, ou se voltou ao estado do lote)
        if (op.outcome !== 'applied' && op.outcome !== 'undo_conflict') continue;
        const before = op.before?.items ?? [];
        const after = op.after?.items ?? [];
        const found = force ? [] : await detectUndoConflicts(transaction, userId, before, after);
        if (found.length > 0) {
          conflicts.push(...found);
          updated[index] = { ...op, outcome: 'undo_conflict', reason: 'o item mudou depois do lote' };
          continue;
        }
        const beforeKeys = new Set(before.map(journalItemKey));
        await deleteJournalItems(transaction, userId, after.filter((item) => !beforeKeys.has(journalItemKey(item))));
        await restoreJournalItems(transaction, userId, before);
        updated[index] = { ...op, outcome: 'undone', reason: null };
      }
    });

    for (const op of updated) await this.store.updateOp(op);
    const undoneAll = conflicts.length === 0;
    const finished: AiBatch = { ...batch, status: undoneAll ? 'undone' : batch.status, undoneAt: undoneAll ? this.clock.now() : batch.undoneAt, summary: summarizeOps(updated) };
    await this.store.updateBatch(finished);
    return { batch: finished, ops: updated, conflicts };
  }
}
