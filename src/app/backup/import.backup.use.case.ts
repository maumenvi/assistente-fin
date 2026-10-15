import { z } from 'zod';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Database } from '../shared/database.port.ts';
import { importBackupRecords, type ImportReport } from './import.backup.records.ts';

export { type ImportReport } from './import.backup.records.ts';

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function'
  );
}

const importBackupInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  /** Mesmo formato que `ExportBackupUseCase` devolve - nao passa por `safeParse` normal
   *  (nao e um shape JSON comum), so a checagem de forma via `z.custom`. */
  records: z.custom<AsyncIterable<unknown>>(isAsyncIterable, 'records deve ser um AsyncIterable'),
  /** Backup de outro aparelho/instalacao (spec 022, FR-007) - ver `ImportBackupOptions`. */
  adoptForeignBackup: z.boolean().optional(),
});

/**
 * Caso de uso "importar backup" (spec 001, RF-18, CA-16, CA-17, plan.md decisao 14).
 *
 * Exige usuario verificado (`UserNotVerifiedError`): assim como `ApproveSimulation`, importar
 * cria dado financeiro de verdade (decisao 9 do plano, lista cresce de novo).
 *
 * Streaming: consome o `AsyncIterable<unknown>` recebido (mesmo formato que
 * `ExportBackupUseCase` produz) e valida cada record com zod conforme chega, nunca
 * materializando o backup inteiro em memoria. Tudo dentro de `Database.transaction()`: se
 * QUALQUER record for invalido (forma errada, header ausente/duplicado, `schemaVersion`
 * incompativel, record de outro usuario), lanca `InvalidBackupError` e a transacao inteira
 * e desfeita - nada do que ja tinha sido salvo nesta importacao fica (CA-17, "sem alterar os
 * dados existentes"). Idempotente por construcao (CA-16): cada `save()` e upsert por id
 * (mesmo id do backup original) - reimportar o mesmo backup nao duplica nada, so sobrescreve
 * com os mesmos valores.
 */
export class ImportBackupUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<ImportReport> {
    const parsed = importBackupInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('importar backup', flat.fieldErrors, flat.formErrors);
    }

    const { userId, records, adoptForeignBackup } = parsed.data;
    const user = await this.database.users.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (!user.isVerified()) {
      throw new UserNotVerifiedError();
    }

    return this.database.transaction((tx) => importBackupRecords(tx, userId, records, { adoptForeignBackup }));
  }
}
