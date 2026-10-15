import { type BackupRecord } from '../shared/backup.record.schema.ts';

/** Backup serializado: NDJSON + contagem por tipo (sem contar o `header`). */
export interface SerializedBackup {
  /** Uma linha JSON por record, terminada em `\n` (formato da Fase 8). */
  readonly payload: string;
  /** `{ account: 2, income: 5, ... }` - alimenta `DataSnapshot.recordCounts`. */
  readonly recordCounts: Record<string, number>;
}

/**
 * Consome um stream de `BackupRecord` e devolve o NDJSON completo + a contagem por tipo
 * (spec 002, RF-37) - usado por `ApplyScenario` pra montar o snapshot antes de mexer nos
 * dados. Materializa em memoria (dado pessoal, poucos KB).
 */
export async function serializeBackup(
  records: AsyncIterable<BackupRecord>,
): Promise<SerializedBackup> {
  let payload = '';
  const recordCounts: Record<string, number> = {};

  for await (const record of records) {
    payload += `${JSON.stringify(record)}\n`;
    if (record.kind !== 'header') {
      recordCounts[record.kind] = (recordCounts[record.kind] ?? 0) + 1;
    }
  }

  return { payload, recordCounts };
}
