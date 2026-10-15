import { Month } from '../shared/month.value.object.ts';
import {
  calculateCreditCardBillingPeriod,
  type CreditCardBillingPeriod,
} from './credit.card.billing.period.ts';

/**
 * Ciclo de fatura de cartao de credito (fechamento+vencimento independentes, spec 008
 * revisao) cujo vencimento e o proximo a ocorrer a partir de `now` (RF-9 - "fatura
 * projetada para o proximo vencimento"): o primeiro ciclo, percorrendo os meses de
 * fechamento a partir do mes anterior ao de `now`, cujo `dueDate` ainda nao passou (ou e
 * hoje).
 *
 * Basta verificar uma janela pequena de meses de fechamento ao redor de `now` porque o
 * vencimento de um ciclo esta sempre no mesmo mes do fechamento ou no seguinte
 * (`calculateCreditCardBillingPeriod`) - o mes anterior ao de `now` cobre o caso em que o
 * fechamento ja passou mas o vencimento (no mes seguinte) ainda nao.
 */
export function nextCreditCardBillingCycle(
  closingDay: number,
  dueDay: number,
  now: Date,
): CreditCardBillingPeriod {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const currentMonth = Month.fromDate(now);

  const candidateMonths = [currentMonth.previous(), currentMonth, currentMonth.next()];
  const candidates = candidateMonths.map((month) =>
    calculateCreditCardBillingPeriod(closingDay, dueDay, month),
  );

  const upcoming = candidates
    .filter((period) => period.dueDate.getTime() >= today.getTime())
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  // upcoming nunca fica vazio: o candidato do mes seguinte ao corrente sempre tem
  // vencimento no futuro em relacao a `today`.
  return upcoming[0] as CreditCardBillingPeriod;
}
