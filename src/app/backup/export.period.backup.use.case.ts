import { z } from 'zod';
import { type Clock } from '../shared/clock.port.ts';
import { type Database } from '../shared/database.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { type BackupRecord } from '../shared/backup.record.schema.ts';
import { selectPeriodClosure } from '../../domain/backup/select.period.closure.ts';
import { type PortableRecord } from '../../domain/backup/portable.record.ts';
import { streamBackupRecords } from './stream.backup.records.ts';

const inputSchema = z
  .object({
    userId: z.string().trim().min(1),
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .refine((value) => value.from <= value.to, { message: 'a data inicial deve ser antes da final', path: ['to'] });

/**
 * Exportar backup por periodo (spec 022, T143; FR-016/FR-017; contracts/period-backup.md): o
 * mesmo formato do backup completo, com `header.scope`, e so o fecho referencial do periodo
 * (`selectPeriodClosure`) - o arquivo importa sozinho em qualquer banco.
 */
export class ExportPeriodBackupUseCase {
  private readonly database: Database;
  private readonly clock: Clock;

  public constructor(database: Database, clock: Clock) {
    this.database = database;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<AsyncGenerator<BackupRecord>> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('exportar backup por periodo', flat.fieldErrors, flat.formErrors);
    }
    const { userId, from, to } = parsed.data;
    if (!(await this.database.users.findById(userId))) throw new UserNotFoundError();

    const all: BackupRecord[] = [];
    for await (const record of streamBackupRecords(this.database, userId, this.clock.now())) all.push(record);
    const [header, ...rest] = all;
    const selected = selectPeriodClosure(rest as unknown as PortableRecord[], { from, to }) as unknown as BackupRecord[];
    return (async function* stream() {
      if (header?.kind === 'header') yield { ...header, scope: { from, to } };
      yield* selected;
    })();
  }
}
