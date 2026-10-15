import { z } from 'zod';

/** Schema da entrada externa de "excluir grupo de parcelas". */
export const deleteInstallmentGroupInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  transactionId: z.string().trim().min(1, 'transactionId obrigatorio'),
});

/** Entrada ja validada de `DeleteInstallmentGroupUseCase`. */
export type DeleteInstallmentGroupInput = z.infer<typeof deleteInstallmentGroupInputSchema>;
