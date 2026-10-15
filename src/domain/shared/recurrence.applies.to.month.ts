import { type Recurrence } from './recurrence.value.object.ts';
import { Month } from './month.value.object.ts';

/**
 * `true` quando um evento com `recurrence`, ancorado no mes de `anchor` (mes da primeira
 * ocorrencia), se aplica ao mes `target` (spec 003, RF-16, RF-24) - usada pela previsao
 * (`domain/forecast/`, projetar `Income`) e pela simulacao de compra recorrente.
 *
 * - `nao-repete`: so no proprio mes-ancora.
 * - `mensal`/`trimestral`/`semestral`/`anual`: aritmetica de meses a partir da ancora,
 *   respeitando `everyN` e o passo da frequencia (1/3/6/12 meses).
 * - `diaria`/`semanal`: simplificado como "todo mes a partir da ancora" - contar quantas
 *   ocorrencias caem num balde mensal fica fora de escopo (limitacao herdada da 001).
 * - Em todos os casos: nunca se aplica depois do mes da `recurrence.endDate` (RF-24).
 */
export function recurrenceAppliesToMonth(recurrence: Recurrence, anchor: Month, target: Month): boolean {
  const monthsBetween = (target.year - anchor.year) * 12 + (target.month - anchor.month);
  if (monthsBetween < 0) return false;

  if (recurrence.frequency === 'nao-repete') {
    return monthsBetween === 0;
  }

  if (recurrence.endDate !== null && target.compare(Month.fromDate(recurrence.endDate)) === 1) {
    return false;
  }

  switch (recurrence.frequency) {
    case 'diaria':
    case 'semanal':
      return true;
    case 'mensal':
      return monthsBetween % recurrence.everyN === 0;
    case 'trimestral':
      return monthsBetween % (3 * recurrence.everyN) === 0;
    case 'semestral':
      return monthsBetween % (6 * recurrence.everyN) === 0;
    case 'anual':
      return monthsBetween % (12 * recurrence.everyN) === 0;
  }
}
