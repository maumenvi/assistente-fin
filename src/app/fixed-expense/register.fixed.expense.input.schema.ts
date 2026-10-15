import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';

/**
 * Schema da entrada externa de "registrar gasto fixo" (spec 001, RF-3, RF-12).
 *
 * Gasto fixo nao tem recorrencia (spec 003, RF-16a) - a previsao ja o projeta em todo mes.
 */
export const registerFixedExpenseInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  dueDay: z.int('dueDay deve ser inteiro').min(1).max(31),
  // Mes de referencia e descricao, opcionais e informativos (spec 006, RF-1/RF-4).
  referenceMonth: z.int('referenceMonth deve ser inteiro').min(1).max(12).optional(),
  description: z.string().trim().max(200, 'description muito longa').optional(),
  expectedAmountCents: z
    .int('valor esperado deve ser inteiro em centavos')
    .positive('valor esperado deve ser positivo'),
  ...categorySelectionSchema,
  accountId: z.string().trim().min(1, 'accountId obrigatorio'),
});

/** Entrada ja validada de `RegisterFixedExpenseUseCase`. */
export type RegisterFixedExpenseInput = z.infer<typeof registerFixedExpenseInputSchema>;
