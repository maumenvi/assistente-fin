import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';

/**
 * Schema da entrada externa de "classificar transacao" (spec 001, RF-6, RF-12).
 *
 * Aqui, ao contrario dos outros lancamentos, a categoria e **obrigatoria**: classificar sem
 * dizer a categoria seria um no-op silencioso (a transacao ja tem a padrao). Por isso o
 * `refine` exige ao menos um dos dois campos (spec 003, RF-13).
 */
export const classifyTransactionInputSchema = z
  .object({
    userId: z.string().trim().min(1, 'userId obrigatorio'),
    id: z.string().trim().min(1, 'id obrigatorio'),
    ...categorySelectionSchema,
  })
  .refine((input) => input.categoryId !== undefined || input.categoryName !== undefined, {
    message: 'informe a categoria (categoryId ou categoryName)',
    path: ['categoryName'],
  });

/** Entrada ja validada de `ClassifyTransactionUseCase`. */
export type ClassifyTransactionInput = z.infer<typeof classifyTransactionInputSchema>;
