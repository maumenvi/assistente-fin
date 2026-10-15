import { z } from 'zod';
import { type Clock } from '../shared/clock.port.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { backupRecordSchema } from '../shared/backup.record.schema.ts';
import { InvalidBackupError } from '../../domain/backup/invalid.backup.error.ts';
import { planPeriodImport } from '../../domain/backup/plan.period.import.ts';
import { resolvePeriodImport } from '../../domain/backup/resolve.period.import.ts';
import { type PortableRecord } from '../../domain/backup/portable.record.ts';
import { emptyImportReport, readBackupRecords, saveBackupRecord, type ImportReport } from './import.backup.records.ts';
import { collectUserRecords } from './collect.user.records.ts';
import { applyImportInputSchema } from './import.plan.schemas.ts';

/**
 * Passo 2 da importacao com conflitos (spec 022, T143; FR-018/FR-019): refaz o plano DENTRO da
 * transacao (o banco pode ter mudado desde o passo 1), aplica as decisoes (`resolvePeriodImport`)
 * e grava tudo ou nada. Conflito sem decisao -> `UnresolvedImportConflictError`, nada gravado.
 */
export class ApplyPeriodImportUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  public constructor(database: Database, ids: IdGenerator, clock: Clock) {
    this.database = database;
    this.ids = ids;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<ImportReport> {
    const parsed = applyImportInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('importar backup', flat.fieldErrors, flat.formErrors);
    }
    const { userId, records, adoptForeignBackup, decisions, defaultDecision } = parsed.data;
    return this.database.transaction(async (tx) => {
      const file = await readBackupRecords(tx, userId, records, { adoptForeignBackup });
      const existing = await collectUserRecords(tx, userId, this.clock.now());
      const plan = planPeriodImport(existing as unknown as PortableRecord[], file.records as unknown as PortableRecord[]);
      const writes = resolvePeriodImport(plan, decisions, defaultDecision, () => this.ids.next());
      const report = emptyImportReport();
      for (const write of writes) {
        const record = backupRecordSchema.safeParse(write);
        if (!record.success || record.data.kind === 'header') throw new InvalidBackupError('registro remapeado invalido');
        report[await saveBackupRecord(tx, record.data)] += 1;
      }
      return report;
    });
  }
}
