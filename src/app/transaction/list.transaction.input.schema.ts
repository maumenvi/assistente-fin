import { z } from 'zod';

/** Schema da entrada externa de "listar transacoes" (spec 002, RF-20). */
export const listTransactionInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `ListTransactionsUseCase`. */
export type ListTransactionInput = z.infer<typeof listTransactionInputSchema>;
