import { z } from 'zod';

/** Schema da entrada externa de "garantir saldo do mes anterior" (spec 011, RF-16). */
export const ensurePreviousMonthBalanceInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  month: z.object({
    year: z.int('year deve ser inteiro'),
    month: z.int('month deve ser inteiro').min(1).max(12),
  }),
});

/** Entrada ja validada de `EnsurePreviousMonthBalanceTransactionUseCase`. */
export type EnsurePreviousMonthBalanceInput = z.infer<typeof ensurePreviousMonthBalanceInputSchema>;
