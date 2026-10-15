import { z } from 'zod';

/** Schema da entrada externa de "excluir limite de gasto" (spec 002, RF-19). */
export const deleteSpendingLimitInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `DeleteSpendingLimitUseCase`. */
export type DeleteSpendingLimitInput = z.infer<typeof deleteSpendingLimitInputSchema>;
