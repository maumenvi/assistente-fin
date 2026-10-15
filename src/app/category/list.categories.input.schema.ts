import { z } from 'zod';

/** Schema da entrada externa de "listar categorias" (spec 003, RF-6, CA-11). */
export const listCategoriesInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `ListCategoriesUseCase`. */
export type ListCategoriesInput = z.infer<typeof listCategoriesInputSchema>;
