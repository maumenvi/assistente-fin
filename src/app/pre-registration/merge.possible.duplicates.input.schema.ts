import { z } from 'zod';

/** Entrada de "juntar duplicatas" (spec 028, FR-018): 2 ou mais pre-registros do mesmo grupo. */
export const mergePossibleDuplicatesInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  ids: z
    .array(z.string().trim().min(1, 'id obrigatorio'))
    .min(2, 'informe ao menos 2 pre-registros')
    .refine((ids) => new Set(ids).size === ids.length, 'ids repetidos'),
});
