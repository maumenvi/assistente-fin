import { Month } from '../shared/month.value.object.ts';
import { clampedDate } from '../shared/clamped.date.ts';

/**
 * Periodo de apuracao `[from, to]` (ambos inclusivos, meia-noite UTC) de uma fatura de
 * cartao de credito, junto com a data de vencimento correspondente a esse ciclo.
 */
export interface CreditCardBillingPeriod {
  readonly from: Date;
  readonly to: Date;
  readonly dueDate: Date;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calcula o periodo de apuracao de um ciclo de fatura de cartao de credito cujo fechamento
 * cai no mes de competencia `closingMonth` (spec 008 revisao, RF-5, RF-5a, decisao 4.1 do
 * plano).
 *
 * Fechamento (`closingDay`) e vencimento (`dueDay`) sao campos independentes, ambos
 * configurados pelo usuario:
 * - **Periodo de apuracao**: `[dia closingDay+1 do fechamento anterior, dia closingDay-1 do
 *   fechamento atual]` - um lancamento com data igual ao `closingDay` (ou posterior) ja
 *   pertence ao ciclo seguinte (RF-5a), entao o `to` deste ciclo e o dia anterior ao
 *   fechamento, e o `from` e o proprio dia do fechamento anterior (que, por essa mesma
 *   regra, ja abre o ciclo novo).
 * - **Data de vencimento**: sempre no dia `dueDay`, mas o mes depende da relacao entre
 *   `dueDay` e `closingDay` no calendario - se `dueDay > closingDay`, vence no mesmo mes do
 *   fechamento; senao (`dueDay <= closingDay`), vence no mes seguinte ao fechamento (caso
 *   mais comum: fecha perto do fim do mes, vence no inicio do mes seguinte).
 *
 * `closingDay`/`dueDay` sao clampados ao ultimo dia do mes quando este for mais curto (ex.:
 * dia 31 em fevereiro).
 */
export function calculateCreditCardBillingPeriod(
  closingDay: number,
  dueDay: number,
  closingMonth: Month,
): CreditCardBillingPeriod {
  const closingDate = clampedDate(closingDay, closingMonth);
  const previousClosingDate = clampedDate(closingDay, closingMonth.previous());

  const from = previousClosingDate;
  const to = new Date(closingDate.getTime() - ONE_DAY_MS);

  const dueMonth = dueDay > closingDay ? closingMonth : closingMonth.next();
  const dueDate = clampedDate(dueDay, dueMonth);

  return { from, to, dueDate };
}
