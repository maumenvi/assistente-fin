import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';

/** Schema da entrada externa de "definir limite de gasto" (spec 001, RF-4, RF-12). */
export const setSpendingLimitInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  ...categorySelectionSchema,
  period: z.object({
    year: z.int().min(1970),
    month: z.int().min(1).max(12),
  }),
  maxAmountCents: z
    .int('valor maximo deve ser inteiro em centavos')
    .positive('valor maximo deve ser positivo'),
});

/** Entrada ja validada de `SetSpendingLimitUseCase`. */
export type SetSpendingLimitInput = z.infer<typeof setSpendingLimitInputSchema>;
