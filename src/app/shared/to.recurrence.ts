import { Recurrence } from '../../domain/shared/recurrence.value.object.ts';
import { type RecurrenceInput } from './recurrence.input.schema.ts';

/**
 * Constroi a `Recurrence` de dominio a partir da entrada ja validada na borda (spec 003,
 * RF-16). O dominio aplica as invariantes que a forma zod nao cobre (endDate x frequencia,
 * alcance por frequencia na entidade dona).
 */
export function toRecurrence(input: RecurrenceInput): Recurrence {
  return Recurrence.create({
    frequency: input.frequency,
    everyN: input.everyN,
    endDate: input.endDate == null ? null : new Date(input.endDate),
  });
}
