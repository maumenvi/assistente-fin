import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';
import { recurrenceInputSchema } from '../shared/recurrence.input.schema.ts';

/** Schema da entrada externa de "atualizar plano de limite de gasto" (spec 016, RF-1). */
export const updateSpendingLimitPlanInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  maxAmountCents: z.int('valor deve ser inteiro em centavos').positive('valor deve ser positivo').optional(),
  recurrence: recurrenceInputSchema.optional(),
  ...categorySelectionSchema,
});

/** Entrada ja validada de `UpdateSpendingLimitPlanUseCase`. */
export type UpdateSpendingLimitPlanInput = z.infer<typeof updateSpendingLimitPlanInputSchema>;
