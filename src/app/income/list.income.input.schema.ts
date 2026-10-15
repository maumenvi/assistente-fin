import { z } from 'zod';

/** Schema da entrada externa de "listar ganhos" (spec 002, RF-17). */
export const listIncomeInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `ListIncomesUseCase`. */
export type ListIncomeInput = z.infer<typeof listIncomeInputSchema>;
