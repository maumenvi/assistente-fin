import { z } from 'zod';
import { CATEGORY_NAME_MAX_LENGTH } from '../../domain/category/category.name.value.object.ts';

/**
 * Schema da entrada externa de "renomear categoria" (spec 003, RF-6, CA-3).
 *
 * `expectedUpdatedAt` (opcional): o `updatedAt` que a borda leu ao abrir a tela - quando
 * presente, o save so grava se o registro nao mudou desde entao (`StaleDataError` senao,
 * RF-31). Mesmo padrao de `updateAccountInputSchema`.
 */
export const renameCategoryInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  name: z
    .string()
    .trim()
    .min(1, 'nome obrigatorio')
    .max(CATEGORY_NAME_MAX_LENGTH, 'nome muito longo'),
});

/** Entrada ja validada de `RenameCategoryUseCase`. */
export type RenameCategoryInput = z.infer<typeof renameCategoryInputSchema>;
