import { z } from 'zod';

/** Schema da entrada externa de "aplicar o mes de um plano de limite de gasto" (spec 016). */
export const applySpendingLimitMonthInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  planId: z.string().trim().min(1, 'planId obrigatorio'),
  month: z.object({
    year: z.int().min(1970),
    month: z.int().min(1).max(12),
  }),
});

/** Entrada ja validada de `ApplySpendingLimitMonthUseCase`. */
export type ApplySpendingLimitMonthInput = z.infer<typeof applySpendingLimitMonthInputSchema>;
