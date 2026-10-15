import { z } from 'zod';
import { DataSnapshotNotFoundError } from '../../domain/scenario/data.snapshot.not.found.error.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type ImportReport } from '../backup/import.backup.records.ts';
import { importBackupRecords } from '../backup/import.backup.records.ts';
import { parseNdjson } from '../backup/parse.ndjson.ts';
import { wipeUserFinancialData } from '../backup/wipe.user.financial.data.ts';
import { snapshotIdInputSchema } from './snapshot.id.input.schema.ts';

/**
 * Caso de uso "restaurar um ponto de restauracao" (spec 002, RF-38 caminho completo, RF-40b,
 * CA-33a, CA-34).
 *
 * Substitui TODOS os dados financeiros atuais do usuario pelos do snapshot - descarta
 * qualquer alteracao feita depois. Exige `isVerified()` (mexe pesado nos dados).
 * `DataSnapshotNotFoundError` fora do escopo do usuario. Dentro de `Database.transaction()`:
 * apaga o dado financeiro do usuario (`wipeUserFinancialData`), reimporta o `payload`
 * (`importBackupRecords`) e encerra a aplicacao ativa, se houver.
 */
export class RestoreDataSnapshotUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<ImportReport> {
    const parsed = snapshotIdInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('restaurar snapshot', flat.fieldErrors, flat.formErrors);
    }

    const { userId, snapshotId } = parsed.data;
    const user = await this.database.users.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (!user.isVerified()) {
      throw new UserNotVerifiedError();
    }

    const snapshot = await this.database.dataSnapshots.findById(userId, snapshotId);
    if (!snapshot) {
      throw new DataSnapshotNotFoundError();
    }

    return this.database.transaction(async (tx): Promise<ImportReport> => {
      await wipeUserFinancialData(tx, userId);
      const report = await importBackupRecords(tx, userId, parseNdjson(snapshot.payload));

      const active = await tx.scenarioApplications.findActiveByUser(userId);
      if (active) {
        await tx.scenarioApplications.delete(userId, active.id);
      }

      return report;
    });
  }
}
