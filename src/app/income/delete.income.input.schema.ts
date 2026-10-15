import { z } from 'zod';

/** Schema da entrada externa de "excluir ganho" (spec 002, RF-17). */
export const deleteIncomeInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `DeleteIncomeUseCase`. */
export type DeleteIncomeInput = z.infer<typeof deleteIncomeInputSchema>;
