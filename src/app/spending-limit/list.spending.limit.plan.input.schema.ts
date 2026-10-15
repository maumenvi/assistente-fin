import { z } from 'zod';

/** Schema da entrada externa de "listar planos de limite de gasto" (spec 016). */
export const listSpendingLimitPlanInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `ListSpendingLimitPlansUseCase`. */
export type ListSpendingLimitPlanInput = z.infer<typeof listSpendingLimitPlanInputSchema>;
