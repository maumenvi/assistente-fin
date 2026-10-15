import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { type TransactionSeries } from '../../domain/transaction/transaction.series.entity.ts';
import { occurrenceDates } from '../../domain/shared/recurrence.occurrences.ts';
import { sameCalendarDay } from '../../libs/date/same.calendar.day.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type TransactionRepository } from './transaction.repository.port.ts';

/**
 * Materializa as ocorrencias de uma serie (spec 003, RF-25): para cada data de
 * `occurrenceDates` que ainda nao tem uma `Transaction` daquela serie, cria uma - todas com
 * o mesmo `seriesId`, os campos copiados do molde.
 *
 * Idempotente por data: reexecutar (ex.: apos "prolongar") so gera as ocorrencias novas. A
 * comparacao e por dia calendario porque e a granularidade da recorrencia; duas ocorrencias
 * da MESMA serie nunca caem no mesmo dia.
 *
 * NAO roda `findDuplicate` (CA-5) - as ocorrencias sao geradas de proposito e podem, por
 * exemplo, colidir com um lancamento manual pre-existente. A deteccao de duplicidade so vale
 * para o que o usuario digita a mao (tarefa 4.8). Deve rodar dentro de `Database.transaction`.
 *
 * `incomeId` (spec 012, RF-5 estendido): quando a serie e o espelho de um `Income` criado a
 * partir do Extrato (`type: income`), TODAS as ocorrencias materializadas - nao so a
 * primeira - recebem o mesmo `incomeId`, para que a tela "Ganhos" (`listLaunchedIncomeMonths`)
 * reconheca cada mes da serie como ja lancado. `undefined`/ausente para series que nao sao
 * espelho de `Income` (o caso mais comum, incluindo toda serie `type: expense`).
 *
 * Devolve as `Transaction` recem-criadas (nao as que ja existiam).
 */
export async function materializeSeries(
  transactions: TransactionRepository,
  ids: IdGenerator,
  series: TransactionSeries,
  incomeId?: string | null,
): Promise<Transaction[]> {
  const existing = (await transactions.listByUser(series.userId)).filter(
    (transaction) => transaction.seriesId === series.id,
  );

  const created: Transaction[] = [];
  for (const date of occurrenceDates(series.recurrence, series.anchorDate)) {
    if (existing.some((transaction) => sameCalendarDay(transaction.date, date))) {
      continue;
    }
    const occurrence = Transaction.create({
      id: ids.next(),
      userId: series.userId,
      date,
      amount: series.amount,
      type: series.type,
      categoryId: series.categoryId,
      accountId: series.accountId,
      notes: series.notes,
      seriesId: series.id,
      incomeId,
    });
    await transactions.save(occurrence);
    created.push(occurrence);
  }
  return created;
}
