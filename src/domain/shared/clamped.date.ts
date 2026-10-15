import { type Month } from './month.value.object.ts';

/**
 * Clampa `day` ao ultimo dia de `month` (ex.: dia 31 em fevereiro vira 28/29) e devolve a
 * data resultante em meia-noite UTC. Funcao pura, extraida de `credit.card.billing.period.ts`
 * (spec 008) para reuso pela aritmetica de "avancar N meses preservando o dia" da spec 009
 * (RF-2, decisao 4.6) - mesma necessidade de fim-de-mes das duas specs.
 */
export function clampedDate(day: number, month: Month): Date {
  const lastDayOfMonth = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  return new Date(Date.UTC(month.year, month.month - 1, Math.min(day, lastDayOfMonth)));
}
