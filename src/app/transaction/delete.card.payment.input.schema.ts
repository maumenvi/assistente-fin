import { z } from 'zod';

/**
 * Schema da entrada externa de "excluir pagamento de fatura" (spec 016, RF-6). Recebe o id de
 * QUALQUER uma das duas pontas - mesmo padrao de `deleteTransferInputSchema`.
 */
export const deleteCardPaymentInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  transactionId: z.string().trim().min(1, 'transactionId obrigatorio'),
});

/** Entrada ja validada de `DeleteCardPaymentUseCase`. */
export type DeleteCardPaymentInput = z.infer<typeof deleteCardPaymentInputSchema>;
