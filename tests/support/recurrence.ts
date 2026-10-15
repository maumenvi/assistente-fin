import { Recurrence } from '../../src/domain/shared/recurrence.value.object.ts';
import { addUtcMonths } from '../../src/domain/shared/add.utc.months.ts';

/**
 * Recorrencia mensal valida para fixtures de teste: termina exatamente no teto de 12 meses
 * da frequencia `mensal` (spec 003, RF-18) a partir de `anchor`.
 */
export function monthlyFrom(anchor: Date | string): Recurrence {
  const start = typeof anchor === 'string' ? new Date(anchor) : anchor;
  return Recurrence.create({ frequency: 'mensal', endDate: addUtcMonths(start, 12) });
}
