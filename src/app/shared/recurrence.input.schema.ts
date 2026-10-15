import { z } from 'zod';
import { RECURRENCE_FREQUENCIES } from '../../domain/shared/recurrence.frequency.ts';

/**
 * Schema da entrada externa de uma recorrencia (spec 003, RF-16, RF-23), reusado por
 * ganho, transacao manual e simulacao.
 *
 * `everyN` e opcional (default 1 no dominio) e o cadastro de novos lancamentos so manda 1;
 * valores maiores viajam so em import de backup / edicao de dado migrado (RF-22). `endDate`
 * so faz sentido quando a frequencia repete - o cruzamento (ausente quando repete, presente
 * em "nao-repete") e a checagem de alcance por frequencia acontecem no dominio.
 */
export const recurrenceInputSchema = z.object({
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  everyN: z.int('everyN deve ser inteiro').min(1).optional(),
  endDate: z.iso.datetime({ offset: true }).or(z.iso.date()).nullish(),
});

/** Entrada ja validada de uma recorrencia (forma; invariantes de dominio a parte). */
export type RecurrenceInput = z.infer<typeof recurrenceInputSchema>;
