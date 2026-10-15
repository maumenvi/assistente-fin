import { type Recurrence } from './recurrence.value.object.ts';
import { addUtcDays } from './add.utc.days.ts';
import { addUtcMonths } from './add.utc.months.ts';

/** Passo em meses de cada frequencia baseada em mes (o resto e baseado em dias). */
const MONTH_STEP: Record<'mensal' | 'trimestral' | 'semestral' | 'anual', number> = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/**
 * Datas concretas de todas as ocorrencias de `recurrence`, comecando em `anchor` e ate
 * `recurrence.endDate` inclusive (spec 003, RF-25). Cada ocorrencia e calculada a partir de
 * `anchor` (nao iterativamente), entao a recorrencia mensal nao "escorrega" quando um mes
 * curto forca o clamp de fim de mes.
 *
 * `nao-repete` devolve so `[anchor]`. Guard-rail de 10.000 ocorrencias contra recorrencia
 * mal formada (nao deveria acontecer - `endDate` e limitada pelo alcance da frequencia).
 */
export function occurrenceDates(recurrence: Recurrence, anchor: Date): Date[] {
  if (recurrence.frequency === 'nao-repete' || recurrence.endDate === null) {
    return [new Date(anchor.getTime())];
  }

  const end = recurrence.endDate.getTime();
  const step = recurrence.everyN;
  const dates: Date[] = [];

  for (let i = 0; i < 10_000; i += 1) {
    const occurrence = occurrenceAt(recurrence, anchor, i * step);
    if (occurrence.getTime() > end) break;
    dates.push(occurrence);
  }
  return dates;
}

/** A ocorrencia `units` unidades da frequencia depois de `anchor`. */
function occurrenceAt(recurrence: Recurrence, anchor: Date, units: number): Date {
  switch (recurrence.frequency) {
    case 'diaria':
      return addUtcDays(anchor, units);
    case 'semanal':
      return addUtcDays(anchor, units * 7);
    case 'mensal':
    case 'trimestral':
    case 'semestral':
    case 'anual':
      return addUtcMonths(anchor, units * MONTH_STEP[recurrence.frequency]);
    case 'nao-repete':
      return new Date(anchor.getTime());
  }
}
