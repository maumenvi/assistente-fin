import { z } from 'zod';
import { type TransactionSeries } from '../../domain/transaction/transaction.series.entity.ts';
import { TransactionSeriesNotFoundError } from '../../domain/transaction/transaction.series.not.found.error.ts';
import { TransactionNotFoundError } from '../../domain/transaction/transaction.not.found.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { startOfUtcDay } from '../../libs/date/start.of.utc.day.ts';
import { endTransactionSeriesInputSchema } from './end.transaction.series.input.schema.ts';

/** Resultado de `EndTransactionSeriesUseCase`: a serie encerrada + quantas ocorrencias sumiram. */
export interface EndTransactionSeriesResult {
  readonly series: TransactionSeries;
  readonly removedOccurrenceCount: number;
}

/**
 * Caso de uso "encerrar serie a partir de uma ocorrencia" (spec 003, RF-29, CA-21).
 *
 * A ocorrencia `fromTransactionId` (o "pivo") e as anteriores ficam; a serie para de gerar
 * dali em diante. Dentro de `database.transaction()`:
 * - apaga as ocorrencias da serie com `date > pivo.date` **e** `date >= hoje` - ou seja, as
 *   futuras ainda nao realizadas. As passadas ficam (historico); as ja **desanexadas**
 *   (`seriesId === null` apos uma edicao - RF-27) nao entram no filtro por `seriesId`.
 * - traz a data final da recorrencia para a data do pivo (`series.endAt`).
 *
 * "Nao realizada" = `date >= hoje`: uma transacao manual nao tem status de pagamento, entao a
 * data e o unico criterio disponivel.
 */
export class EndTransactionSeriesUseCase {
  private readonly database: Database;
  private readonly clock: Clock;

  public constructor(database: Database, clock: Clock) {
    this.database = database;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<EndTransactionSeriesResult> {
    const parsed = endTransactionSeriesInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('encerrar serie', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const today = startOfUtcDay(this.clock.now());

    return this.database.transaction(async (tx) => {
      const series = await tx.transactionSeries.findById(input.userId, input.seriesId);
      if (!series) {
        throw new TransactionSeriesNotFoundError();
      }

      const pivot = await tx.transactions.findById(input.userId, input.fromTransactionId);
      if (!pivot || pivot.seriesId !== series.id) {
        throw new TransactionNotFoundError();
      }

      const pivotDay = startOfUtcDay(pivot.date).getTime();
      const occurrences = (await tx.transactions.listByUser(input.userId)).filter(
        (transaction) =>
          transaction.seriesId === series.id &&
          startOfUtcDay(transaction.date).getTime() > pivotDay &&
          startOfUtcDay(transaction.date).getTime() >= today.getTime(),
      );
      for (const occurrence of occurrences) {
        await tx.transactions.delete(input.userId, occurrence.id);
      }

      const ended = series.endAt(pivot.date);
      await tx.transactionSeries.save(ended);

      return { series: ended, removedOccurrenceCount: occurrences.length };
    });
  }
}
