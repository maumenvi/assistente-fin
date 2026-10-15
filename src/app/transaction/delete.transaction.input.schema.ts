import { z } from 'zod';

/** Schema da entrada externa de "excluir transacao" (spec 002, RF-20). */
export const deleteTransactionInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `DeleteTransactionUseCase`. */
export type DeleteTransactionInput = z.infer<typeof deleteTransactionInputSchema>;
