import { z } from 'zod';

/** Schema da entrada externa de "listar limites de gasto" (spec 002, RF-19). */
export const listSpendingLimitInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `ListSpendingLimitsUseCase`. */
export type ListSpendingLimitInput = z.infer<typeof listSpendingLimitInputSchema>;
