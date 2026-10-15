import { z } from 'zod';

/** Schema da entrada externa de "excluir varias transacoes". */
export const deleteManyTransactionsInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  ids: z.array(z.string().trim().min(1, 'id obrigatorio')).min(1, 'informe ao menos um id'),
});

/** Entrada ja validada de `DeleteManyTransactionsUseCase`. */
export type DeleteManyTransactionsInput = z.infer<typeof deleteManyTransactionsInputSchema>;
