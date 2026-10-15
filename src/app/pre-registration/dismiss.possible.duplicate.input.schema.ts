import { z } from 'zod';

/** Entrada de "sao compras diferentes" (spec 028, FR-018): 1 ou mais pre-registros. */
export const dismissPossibleDuplicateInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  ids: z
    .array(z.string().trim().min(1, 'id obrigatorio'))
    .min(1, 'informe ao menos 1 pre-registro')
    .refine((ids) => new Set(ids).size === ids.length, 'ids repetidos'),
});
