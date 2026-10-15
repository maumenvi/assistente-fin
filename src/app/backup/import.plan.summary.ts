import { type BackupRecord } from '../shared/backup.record.schema.ts';

/** Um conflito para a tela "como colar arquivos": o atual e o do arquivo. */
export interface ImportConflictView {
  readonly conflictId: string;
  readonly kind: string;
  readonly id: string;
  readonly current: BackupRecord;
  readonly incoming: BackupRecord;
}

/** Resultado do plano de importacao (contracts/period-backup.md). */
export interface ImportPlanSummary {
  /** `null` = backup completo; senao o intervalo do backup por periodo. */
  readonly scope: { readonly from: string; readonly to: string } | null;
  readonly summary: { readonly new: number; readonly identical: number; readonly conflicts: number };
  readonly conflicts: readonly ImportConflictView[];
}
