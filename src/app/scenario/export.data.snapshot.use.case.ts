import { z } from 'zod';
import { DataSnapshotNotFoundError } from '../../domain/scenario/data.snapshot.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type DataSnapshotRepository } from './data.snapshot.repository.port.ts';
import { snapshotIdInputSchema } from './snapshot.id.input.schema.ts';

/** Conteudo de um snapshot para a borda gravar em arquivo (spec 002, RF-40a). */
export interface ExportedDataSnapshot {
  readonly snapshotId: string;
  readonly takenAt: Date;
  readonly originScenarioId: string | null;
  readonly recordCounts: Readonly<Record<string, number>>;
  /** NDJSON de `BackupRecord` - mesmo formato de um backup da Fase 8 (pode ser reimportado). */
  readonly payload: string;
}

/**
 * Caso de uso "exportar um ponto de restauracao para arquivo" (spec 002, RF-40a). So leitura;
 * devolve o `payload` + metadados. Quem grava o arquivo (dialog "salvar") e a borda.
 * `DataSnapshotNotFoundError` fora do escopo do usuario.
 */
export class ExportDataSnapshotUseCase {
  private readonly snapshots: DataSnapshotRepository;

  public constructor(snapshots: DataSnapshotRepository) {
    this.snapshots = snapshots;
  }

  public async execute(rawInput: unknown): Promise<ExportedDataSnapshot> {
    const parsed = snapshotIdInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('exportar snapshot', flat.fieldErrors, flat.formErrors);
    }

    const snapshot = await this.snapshots.findById(parsed.data.userId, parsed.data.snapshotId);
    if (!snapshot) {
      throw new DataSnapshotNotFoundError();
    }

    return {
      snapshotId: snapshot.id,
      takenAt: snapshot.takenAt,
      originScenarioId: snapshot.originScenarioId,
      recordCounts: snapshot.recordCounts,
      payload: snapshot.payload,
    };
  }
}
