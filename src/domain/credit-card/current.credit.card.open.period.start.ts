import { nextCreditCardBillingCycle } from './next.credit.card.billing.cycle.ts';

/**
 * Inicio do periodo de apuracao "em aberto" (ainda nao vencido) de um cartao de credito, a
 * partir de `now` (spec 008, RF-7 - "faturas em aberto"). E o `from` do ciclo cujo
 * vencimento e o proximo a ocorrer (fatura ja fechada, aguardando pagamento) ou que ainda
 * esta sendo formado (fatura corrente, ainda nao fechou). Sem limite superior: qualquer
 * despesa lancada dai em diante, mesmo em mes futuro, ainda esta em aberto.
 */
export function currentCreditCardOpenPeriodStart(
  closingDay: number,
  dueDay: number,
  now: Date,
): Date {
  return nextCreditCardBillingCycle(closingDay, dueDay, now).from;
}
