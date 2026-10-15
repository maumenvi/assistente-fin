import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';

/**
 * Schema da entrada externa de "atualizar gasto fixo" (spec 002, RF-18, RF-31).
 *
 * Campos de mudanca opcionais. `expectedUpdatedAt` (opcional): a versao lida pela borda, pra
 * trava otimista no save.
 */
export const updateFixedExpenseInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  /** Move o gasto fixo pra outra conta do mesmo usuario. */
  accountId: z.string().trim().min(1, 'accountId obrigatorio').optional(),
  dueDay: z.int('dueDay deve ser inteiro').min(1).max(31).optional(),
  // Mes de referencia e descricao, opcionais e informativos (spec 006, RF-1/RF-4).
  referenceMonth: z.int('referenceMonth deve ser inteiro').min(1).max(12).optional(),
  description: z.string().trim().max(200, 'description muito longa').optional(),
  expectedAmountCents: z.int('valor esperado deve ser inteiro em centavos').positive('valor esperado deve ser positivo').optional(),
  ...categorySelectionSchema,
});

/** Entrada ja validada de `UpdateFixedExpenseUseCase`. */
export type UpdateFixedExpenseInput = z.infer<typeof updateFixedExpenseInputSchema>;
