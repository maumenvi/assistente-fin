import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';

/**
 * Schema da entrada externa de "atualizar limite de gasto" (spec 002, RF-19, RF-31).
 * Campos de mudanca opcionais; `expectedUpdatedAt` (opcional) aplica a trava otimista.
 */
export const updateSpendingLimitInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  ...categorySelectionSchema,
  period: z.object({ year: z.int().min(1970), month: z.int().min(1).max(12) }).optional(),
  maxAmountCents: z
    .int('valor maximo deve ser inteiro em centavos')
    .positive('valor maximo deve ser positivo')
    .optional(),
});

/** Entrada ja validada de `UpdateSpendingLimitUseCase`. */
export type UpdateSpendingLimitInput = z.infer<typeof updateSpendingLimitInputSchema>;
