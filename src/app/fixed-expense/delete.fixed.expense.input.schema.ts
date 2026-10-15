import { z } from 'zod';

/** Schema da entrada externa de "excluir gasto fixo" (spec 002, RF-18). */
export const deleteFixedExpenseInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `DeleteFixedExpenseUseCase`. */
export type DeleteFixedExpenseInput = z.infer<typeof deleteFixedExpenseInputSchema>;
