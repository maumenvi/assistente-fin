import { type AiBatchSource } from './ai.batch.source.ts';
import { type AiBatchStatus } from './ai.batch.status.ts';
import { type AiBatchSummary } from './ai.batch.summary.ts';

/** Um lote de operacoes vindo de um bloco do agente (spec 029, data-model.md §2). */
export interface AiBatch {
  readonly batchId: string;
  readonly userId: string;
  readonly snapshotId: string | null;
  readonly source: AiBatchSource;
  readonly status: AiBatchStatus;
  readonly createdAt: Date;
  readonly appliedAt: Date | null;
  readonly undoneAt: Date | null;
  readonly summary: AiBatchSummary;
}
