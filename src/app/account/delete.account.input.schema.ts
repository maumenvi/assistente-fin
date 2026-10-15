import { z } from 'zod';

/** Schema da entrada externa de "excluir conta" (spec 001, RF-1, RF-12). */
export const deleteAccountInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `DeleteAccountUseCase`. */
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;
