import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';
import { recurrenceInputSchema } from '../shared/recurrence.input.schema.ts';

/** Schema da entrada externa de "registrar plano de limite de gasto" (spec 016, RF-1). */
export const registerSpendingLimitPlanInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  maxAmountCents: z.int('valor deve ser inteiro em centavos').positive('valor deve ser positivo'),
  recurrence: recurrenceInputSchema,
  ...categorySelectionSchema,
});

/** Entrada ja validada de `RegisterSpendingLimitPlanUseCase`. */
export type RegisterSpendingLimitPlanInput = z.infer<typeof registerSpendingLimitPlanInputSchema>;
