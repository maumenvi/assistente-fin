import { z } from 'zod';
import { type TransactionSeries } from '../../domain/transaction/transaction.series.entity.ts';
import { TransactionSeriesNotFoundError } from '../../domain/transaction/transaction.series.not.found.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { materializeSeries } from './materialize.series.ts';
import { extendTransactionSeriesInputSchema } from './extend.transaction.series.input.schema.ts';

/** Resultado de `ExtendTransactionSeriesUseCase`: a serie prolongada + quantas ocorrencias novas. */
export interface ExtendTransactionSeriesResult {
  readonly series: TransactionSeries;
  readonly createdOccurrenceCount: number;
}

/**
 * Caso de uso "prolongar serie de transacoes" (spec 003, RF-21, CA-18, CA-25b).
 *
 * `series.extend()` empurra a data final em um alcance maximo da frequencia, a partir da data
 * final atual (nao "hoje"). Dentro de `database.transaction()`: grava a serie e materializa
 * as ocorrencias que passaram a caber - a dedup nao roda (as ocorrencias sao geradas de
 * proposito, igual a 4.4).
 *
 * A tela so oferece a acao quando falta <= 1 periodo da frequencia para a data final (RF-21),
 * mas o caso de uso nao reforca isso: prolongar cedo demais so gera as ocorrencias do proximo
 * alcance, sem nenhum efeito ruim.
 *
 * `incomeId` (spec 012, RF-5 estendido): nao ha `TransactionSeries.incomeId` (Q2) - se a serie
 * e espelho de um `Income` criado pelo Extrato, toda ocorrencia ja materializada carrega o
 * mesmo `incomeId` (RF-5, `RecordTransactionUseCase`/`materializeSeries`). Antes de prolongar,
 * este caso de uso le o `incomeId` de uma ocorrencia existente da serie e repassa para as
 * ocorrencias novas - sem isso, os meses gerados por "prolongar" apareceriam como "nao
 * lancados" na tela "Ganhos" apesar de existirem no Extrato.
 */
export class ExtendTransactionSeriesUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<ExtendTransactionSeriesResult> {
    const parsed = extendTransactionSeriesInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('prolongar serie', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    return this.database.transaction(async (tx) => {
      const current = await tx.transactionSeries.findById(input.userId, input.seriesId);
      if (!current) {
        throw new TransactionSeriesNotFoundError();
      }

      const { series } = current.extend();
      await tx.transactionSeries.save(series);

      const existingOccurrence = (await tx.transactions.listByUser(input.userId)).find(
        (transaction) => transaction.seriesId === series.id,
      );
      const incomeId = existingOccurrence?.incomeId ?? null;

      const created = await materializeSeries(tx.transactions, this.ids, series, incomeId);
      return { series, createdOccurrenceCount: created.length };
    });
  }
}
