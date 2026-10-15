import { z } from 'zod';

/**
 * Schema da entrada externa de "excluir transferencia" (spec 016, RF-5). Recebe o id de
 * QUALQUER uma das duas pontas - mesmo padrao de `deleteInstallmentGroupInputSchema`.
 */
export const deleteTransferInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  transactionId: z.string().trim().min(1, 'transactionId obrigatorio'),
});

/** Entrada ja validada de `DeleteTransferUseCase`. */
export type DeleteTransferInput = z.infer<typeof deleteTransferInputSchema>;
