import { z } from 'zod';

/** Schema da entrada externa de "migrar categoria de transferência" (spec 016, RF-10). */
export const migrateTransferCategoryInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `MigrateTransferCategoryUseCase`. */
export type MigrateTransferCategoryInput = z.infer<typeof migrateTransferCategoryInputSchema>;
