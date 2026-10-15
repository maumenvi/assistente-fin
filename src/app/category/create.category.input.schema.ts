import { z } from 'zod';
import { CATEGORY_NAME_MAX_LENGTH } from '../../domain/category/category.name.value.object.ts';

/**
 * Schema da entrada externa de "criar categoria" (spec 003, RF-6, RF-9).
 *
 * So checa a forma: o `max` aqui e o mesmo limite do `CategoryName`, mas quem normaliza
 * (MAIUSCULAS, espacos internos) e o dominio - a borda nao pode decidir a identidade da
 * categoria (rule 11).
 */
export const createCategoryInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  name: z
    .string()
    .trim()
    .min(1, 'nome obrigatorio')
    .max(CATEGORY_NAME_MAX_LENGTH, 'nome muito longo'),
});

/** Entrada ja validada de `CreateCategoryUseCase`. */
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
