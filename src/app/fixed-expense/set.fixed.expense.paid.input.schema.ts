import { z } from 'zod';

/** Schema da entrada externa de "marcar gasto fixo pago/nao pago" (spec 002, RF-18). */
export const setFixedExpensePaidInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  paid: z.boolean(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
});

/** Entrada ja validada de `SetFixedExpensePaidUseCase`. */
export type SetFixedExpensePaidInput = z.infer<typeof setFixedExpensePaidInputSchema>;
