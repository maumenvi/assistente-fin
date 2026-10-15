import { z } from 'zod';
import { type Clock } from '../shared/clock.port.ts';
import { type Database } from '../shared/database.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type BackupRecord } from '../shared/backup.record.schema.ts';
import { planPeriodImport } from '../../domain/backup/plan.period.import.ts';
import { type PortableRecord } from '../../domain/backup/portable.record.ts';
import { readBackupRecords } from './import.backup.records.ts';
import { collectUserRecords } from './collect.user.records.ts';
import { planImportInputSchema } from './import.plan.schemas.ts';
import { type ImportPlanSummary } from './import.plan.summary.ts';

/**
 * Passo 1 da importacao com conflitos (spec 022, T143; FR-018): compara o arquivo (por periodo
 * ou completo) com o que ja existe e devolve novos, identicos e conflitos. NADA e gravado.
 */
export class PlanPeriodImportUseCase {
  private readonly database: Database;
  private readonly clock: Clock;

  public constructor(database: Database, clock: Clock) {
    this.database = database;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<ImportPlanSummary> {
    const parsed = planImportInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('planejar importacao', flat.fieldErrors, flat.formErrors);
    }
    const { userId, records, adoptForeignBackup } = parsed.data;
    const file = await readBackupRecords(this.database, userId, records, { adoptForeignBackup });
    const existing = await collectUserRecords(this.database, userId, this.clock.now());
    const plan = planPeriodImport(existing as unknown as PortableRecord[], file.records as unknown as PortableRecord[]);
    return {
      scope: file.header.scope ?? null,
      summary: { new: plan.newIds.size, identical: plan.identicalIds.size, conflicts: plan.conflicts.length },
      conflicts: plan.conflicts.map((c) => ({
        conflictId: c.conflictId,
        kind: c.kind,
        id: c.id,
        current: c.current as unknown as BackupRecord,
        incoming: c.incoming as unknown as BackupRecord,
      })),
    };
  }
}
