import { z } from 'zod';

/** Schema da entrada externa de "lancar o mes de um ganho" (spec 012, RF-3/RF-7). */
export const launchIncomeMonthInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  incomeId: z.string().trim().min(1, 'incomeId obrigatorio'),
  month: z.object({
    year: z.int().min(1970),
    month: z.int().min(1).max(12),
  }),
});

/** Entrada ja validada de `LaunchIncomeMonthUseCase`. */
export type LaunchIncomeMonthInput = z.infer<typeof launchIncomeMonthInputSchema>;
