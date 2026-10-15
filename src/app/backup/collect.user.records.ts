import { type Database } from '../shared/database.port.ts';
import { type BackupRecord } from '../shared/backup.record.schema.ts';
import { streamBackupRecords } from './stream.backup.records.ts';

/** Todos os records atuais do usuario, no formato do backup (sem o header). */
export async function collectUserRecords(database: Database, userId: string, now: Date): Promise<BackupRecord[]> {
  const out: BackupRecord[] = [];
  for await (const record of streamBackupRecords(database, userId, now)) if (record.kind !== 'header') out.push(record);
  return out;
}
