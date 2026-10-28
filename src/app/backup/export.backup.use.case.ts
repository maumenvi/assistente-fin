import { z } from 'zod';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { type BackupRecord } from '../shared/backup.record.schema.ts';
import { streamBackupRecords } from './stream.backup.records.ts';

const exportBackupInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/**
 * Caso de uso "exportar backup" (spec 001, RF-17, CA-15).
 *
 * Streaming (decisao do usuario, nao a JSON unico): `execute` valida a entrada e confirma o
 * usuario ainda antes de devolver qualquer coisa (falha rapido, sem abrir o stream a toa) e
 * so entao devolve um `AsyncGenerator<BackupRecord>` - quem chama consome com `for await`
 * e decide o que fazer com cada record (gravar NDJSON num arquivo, mandar por rede aos
 * poucos, etc.) sem precisar reter o backup inteiro em memoria de um lado ou do outro.
 *
 * Ordem dos records: `header` primeiro, depois `account` -> `income` -> `fixedExpense` ->
 * `spendingLimit` -> `transaction` -> `purchaseSimulation` (accounts sempre antes dos
 * registros que referenciam `accountId`, pra `ImportBackupUseCase` poder gravar num unico
 * passe, sem precisar reordenar). `VerificationCode` fica de fora de proposito (efemero).
 *
 * Streaming aqui e no nivel da interface do caso de uso, nao do banco: cada
 * `Repository.listByUser` ainda carrega a colecao inteira daquele tipo em memoria (uma de
 * cada vez, nunca todas juntas) - streaming cursor-a-cursor desde o Postgres exigiria mudar
 * todo repositorio das Fases 1-7 so por causa do backup, fora do escopo desta fase
 * (documentado em plan.md, decisao 14).
 */
export class ExportBackupUseCase {
  private readonly database: Database;
  private readonly clock: Clock;

  public constructor(database: Database, clock: Clock) {
    this.database = database;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<AsyncGenerator<BackupRecord>> {
    const parsed = exportBackupInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('exportar backup', flat.fieldErrors, flat.formErrors);
    }

    const { userId } = parsed.data;
    const user = await this.database.users.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    return streamBackupRecords(this.database, userId, this.clock.now(), { preferences: true, rules: true });
  }
}
