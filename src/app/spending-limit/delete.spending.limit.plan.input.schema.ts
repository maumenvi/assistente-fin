import { z } from 'zod';

/** Schema da entrada externa de "excluir plano de limite de gasto" (spec 016). */
export const deleteSpendingLimitPlanInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `DeleteSpendingLimitPlanUseCase`. */
export type DeleteSpendingLimitPlanInput = z.infer<typeof deleteSpendingLimitPlanInputSchema>;
