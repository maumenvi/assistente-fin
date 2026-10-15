import { z } from 'zod';

/** Schema da entrada externa de "listar gastos fixos" (spec 002, RF-18). */
export const listFixedExpenseInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `ListFixedExpensesUseCase`. */
export type ListFixedExpenseInput = z.infer<typeof listFixedExpenseInputSchema>;
