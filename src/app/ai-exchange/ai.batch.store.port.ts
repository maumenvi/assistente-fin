import { type AiBatch } from './ai.batch.ts';
import { type AiBatchOp } from './ai.batch.op.ts';

/**
 * Onde fica o diario de lotes (spec 029, R4): SQLite cifrado do celular, sem sincronizar. Fora da
 * porta `Database`: o diario e do aparelho, como os rascunhos de formulario (spec 024).
 */
export interface AiBatchStore {
  /** Grava o lote e todas as suas operacoes, substituindo um lote anterior de mesmo id. */
  saveBatch(batch: AiBatch, ops: readonly AiBatchOp[]): Promise<void>;
  findBatch(userId: string, batchId: string): Promise<AiBatch | null>;
  /** Mais recentes primeiro. */
  listBatches(userId: string, limit: number): Promise<AiBatch[]>;
  /** Em ordem de aplicacao (`seq` crescente). */
  listOps(batchId: string): Promise<AiBatchOp[]>;
  /** Operacoes (de qualquer lote) que tocaram a entidade: base da checagem de conflito. */
  findOpsByEntityId(entityId: string): Promise<AiBatchOp[]>;
  updateBatch(batch: AiBatch): Promise<void>;
  updateOp(op: AiBatchOp): Promise<void>;
  deleteBatch(userId: string, batchId: string): Promise<void>;
}
